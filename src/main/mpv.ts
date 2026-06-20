import { spawn, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { createConnection, Socket } from 'net'
import path from 'path'
import fs from 'fs'
import os from 'os'

export interface MpvStatus {
  state: 'playing' | 'paused' | 'stopped' | 'idle'
  duration: number
  timePos: number
  filename: string
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}


function findMpv(): string {
  if (process.platform !== 'win32') return 'mpv'

  // Check bundled mpv first
  const bundledDir = app.isPackaged
    ? path.join(process.resourcesPath, 'mpv')
    : path.join(__dirname, '../../resources/mpv')
  const bundledExe = path.join(bundledDir, 'mpv.exe')
  try {
    if (fs.existsSync(bundledExe)) return bundledExe
  } catch {}

  const candidates = [
    'mpv.exe',
    'mpv.com',
  ]
  const searchDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  searchDirs.push(
    'C:\\Program Files\\mpv',
    'C:\\Program Files (x86)\\mpv',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'mpv') : '',
    process.env.APPDATA ? path.join(process.env.APPDATA, 'mpv') : '',
  )
  for (const dir of searchDirs) {
    if (!dir) continue
    for (const name of candidates) {
      const full = path.join(dir, name)
      try { if (fs.existsSync(full)) return full } catch { }
    }
  }
  return 'mpv'
}

export class MpvPlayer {
  private proc: ChildProcess | null = null
  private sock: Socket | null = null
  private reqId = 0
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>()
  private ipcPath = ''
  private ipcPort: number | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private overlayWin: BrowserWindow | null = null
  private mainWindow: BrowserWindow | null = null
  private stderrLog: string[] | null = null
  private savedStderr = ''
  private procExited = false

  status: MpvStatus = { state: 'idle', duration: 0, timePos: 0, filename: '' }
  onStatusChange: ((status: MpvStatus) => void) | null = null
  onStopped: (() => void) | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async open(filePath: string, bounds?: Bounds): Promise<void> {
    await this.close()

    this.procExited = false
    this.savedStderr = ''
    this.stderrLog = null

    const b = bounds || { x: 100, y: 100, w: 640, h: 360 }

    const win = new BrowserWindow({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.round(b.w),
      height: Math.round(b.h),
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      show: true,
      alwaysOnTop: true,
      parent: this.mainWindow ?? undefined,
      webPreferences: { contextIsolation: true, sandbox: true },
    })
    await win.loadURL('about:blank')
    win.setIgnoreMouseEvents(true, { forward: true })
    this.overlayWin = win

    const handleBuf = win.getNativeWindowHandle()
    let wid: number
    if (process.platform === 'win32') {
      wid = handleBuf.readUInt32LE()
    } else {
      wid = Number(handleBuf.readBigUInt64LE())
    }

    const timestamp = Date.now()
    if (process.platform === 'win32') {
      this.ipcPath = `\\\\.\\pipe\\mpv-ipc-${timestamp}`
      this.ipcPort = null
    } else {
      this.ipcPath = path.join(os.tmpdir(), `mpv-ipc-${timestamp}.sock`)
      this.ipcPort = null
    }

    const args = [
      `--wid=${wid}`,
      `--input-ipc-server=${this.ipcPath}`,
      '--keep-open=yes',
      '--osc=no',
      '--osd-level=0',
      '--no-border',
      '--no-input-default-bindings',
      '--no-audio-display',
      filePath,
    ]

    const mpvExe = findMpv()
    this.stderrLog = []
    this.stderrLog.push(`[findMpv] resolved to: ${mpvExe}`)
    this.proc = spawn(mpvExe, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const currentProc = this.proc
    this.stderrLog.push(`[spawn] ${mpvExe} ${args.join(' ')}`)
    this.stderrLog.push(`[spawn pid] ${this.proc.pid ?? 'NO PID (spawn failed)'}`)
    if (!this.proc.pid) {
      this.stderrLog.push(`[spawn] mpv binary not found or failed to launch`)
      this.procExited = true
    }

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      if (this.proc !== currentProc) return
      this.stderrLog?.push(chunk.toString())
    })
    this.proc.on('error', (err) => {
      if (this.proc !== currentProc) return
      this.stderrLog?.push(`[spawn error] ${err.message}`)
      this.procExited = true
    })
    this.proc.on('exit', (code) => {
      if (this.proc !== currentProc) return
      this.procExited = true
      if (code !== 0 && code !== null) {
        this.stderrLog?.push(`[mpv exited] code=${code}`)
      }
      this.savedStderr = this.stderrLog?.join('\n') ?? ''
      this.onProcessExit()
    })
    await this.waitForIpc()
    await this.connectIpc()

    const dur = await this.getProperty<number>('duration')
    const fn = await this.getProperty<string>('filename')
    this.status = {
      state: 'playing',
      duration: dur ?? 0,
      timePos: 0,
      filename: fn ?? path.basename(filePath),
    }
    this.onStatusChange?.(this.status)
    this.startPolling()
  }

  private async waitForIpc(timeout = 8000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.proc || this.proc.killed || this.procExited) {
        const msg = this.savedStderr || this.stderrLog?.join('\n') || '(no stderr output)'
        throw new Error(`mpv exited before IPC ready\nmpv stderr:\n${msg}`)
      }
      if (this.ipcPort !== null) {
        // TCP mode (non-Windows)
        try {
          await new Promise<void>((resolve, reject) => {
            const s = createConnection(this.ipcPort!, '127.0.0.1', () => { s.destroy(); resolve() })
            s.on('error', reject)
          })
          return
        } catch { }
      } else if (process.platform === 'win32') {
        // Windows named pipe - try connecting
        try {
          await new Promise<void>((resolve, reject) => {
            const s = createConnection(this.ipcPath, () => { s.destroy(); resolve() })
            s.on('error', reject)
          })
          return
        } catch { }
      } else if (fs.existsSync(this.ipcPath)) {
        return
      }
      await new Promise(r => setTimeout(r, 200))
    }
    const msg = this.savedStderr || this.stderrLog?.join('\n') || '(no stderr output)'
    throw new Error(`Timeout waiting for mpv IPC socket\nmpv stderr:\n${msg}`)
  }

  private connectIpc(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = this.ipcPort !== null
        ? createConnection(this.ipcPort, '127.0.0.1')
        : createConnection(this.ipcPath)
      sock.on('connect', () => {
        this.sock = sock
        resolve()
      })
      sock.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').trim().split('\n')
        for (const line of lines) {
          if (!line) continue
          try {
            const msg = JSON.parse(line)
            const reqId = msg.request_id
            if (reqId !== undefined && this.pending.has(String(reqId))) {
              const p = this.pending.get(String(reqId))!
              const pkt = msg.error === undefined ? msg : msg.error === 'success' ? msg : null
              if (!pkt) {
                p.reject(new Error(msg.error))
              } else {
                p.resolve(msg.data !== undefined ? msg.data : msg)
              }
              this.pending.delete(String(reqId))
            }
          } catch { }
        }
      })
      sock.on('error', (err) => {
        if (this.sock === sock) this.sock = null
        const stderr = this.savedStderr || this.stderrLog?.join('') || ''
        const msg = stderr ? `${err.message}\nmpv stderr: ${stderr}` : err.message
        reject(new Error(msg))
      })
      sock.on('close', () => {
        if (this.sock === sock) this.sock = null
      })
    })
  }

  private sendCommand(command: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error('Not connected to mpv'))
      const id = String(++this.reqId)
      this.pending.set(id, { resolve, reject })
      this.sock.write(JSON.stringify({ command, request_id: id }) + '\n')
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`mpv command timed out: ${command[0]}`))
        }
      }, 8000)
    })
  }

  async getProperty<T>(name: string): Promise<T | undefined> {
    return this.sendCommand(['get_property', name])
  }

  async setProperty(name: string, value: any): Promise<void> {
    await this.sendCommand(['set_property', name, value])
  }

  async play(): Promise<void> {
    await this.setProperty('pause', false)
    this.status.state = 'playing'
    this.onStatusChange?.(this.status)
  }

  async pause(): Promise<void> {
    await this.setProperty('pause', true)
    this.status.state = 'paused'
    this.onStatusChange?.(this.status)
  }

  async togglePause(): Promise<void> {
    await this.sendCommand(['cycle', 'pause'])
    const paused = await this.getProperty<boolean>('pause')
    this.status.state = paused ? 'paused' : 'playing'
    this.onStatusChange?.(this.status)
  }

  async seek(time: number): Promise<void> {
    await this.sendCommand(['seek', time, 'absolute'])
  }

  async captureFrame(): Promise<ArrayBuffer> {
    const outPath = path.join(os.tmpdir(), `mpv-frame-${Date.now()}.jpg`)
    await this.sendCommand(['screenshot-to-file', outPath, 'subtitles'])
    const start = Date.now()
    while (Date.now() - start < 5000) {
      if (fs.existsSync(outPath)) {
        const buf = fs.readFileSync(outPath)
        fs.unlinkSync(outPath)
        const arrayBuffer = new ArrayBuffer(buf.length)
        new Uint8Array(arrayBuffer).set(buf)
        return arrayBuffer
      }
      await new Promise(r => setTimeout(r, 50))
    }
    throw new Error('Screenshot timed out')
  }

  async resize(bounds: Bounds): Promise<void> {
    if (this.overlayWin && !this.overlayWin.isDestroyed()) {
      this.overlayWin.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.w),
        height: Math.round(bounds.h),
      })
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        const pos = await this.getProperty<number>('time-pos')
        const dur = await this.getProperty<number>('duration')
        if (pos !== undefined) this.status.timePos = pos
        if (dur !== undefined) this.status.duration = dur
        this.onStatusChange?.(this.status)
      } catch { }
    }, 250)
  }

  private onProcessExit(): void {
    this.cleanup()
    this.onStopped?.()
  }

  private cleanup(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    this.sock?.destroy()
    this.sock = null
    this.proc = null
    this.ipcPort = null
    if (this.overlayWin && !this.overlayWin.isDestroyed()) {
      this.overlayWin.close()
    }
    this.overlayWin = null
    if (this.ipcPath && process.platform !== 'win32') {
      try { if (fs.existsSync(this.ipcPath)) fs.unlinkSync(this.ipcPath) } catch { }
    }
    this.status = { state: 'idle', duration: 0, timePos: 0, filename: '' }
    this.onStatusChange?.(this.status)
  }

  async close(): Promise<void> {
    if (this.proc) {
      try { await this.sendCommand(['quit']) } catch { }
      try { this.proc.kill() } catch { }
    }
    this.cleanup()
  }
}

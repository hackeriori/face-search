import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

export interface PlayerStatus {
  state: 'playing' | 'paused' | 'stopped' | 'idle'
  duration: number
  timePos: number
  filename: string
  streamUrl?: string
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

function findBinary(name: 'ffmpeg' | 'ffprobe'): string {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name
  const bundledDir = app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'ffmpeg')
    : path.join(__dirname, '../../resources/ffmpeg')
  const bundledExe = path.join(bundledDir, exeName)
  try {
    if (fs.existsSync(bundledExe)) return bundledExe
  } catch {}

  if (process.platform !== 'win32') return name

  const searchDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  searchDirs.push(
    'C:\\ffmpeg\\bin',
    'C:\\Program Files\\ffmpeg\\bin',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'ffmpeg', 'bin') : '',
  )

  for (const dir of searchDirs) {
    if (!dir) continue
    const full = path.join(dir, exeName)
    try {
      if (fs.existsSync(full)) return full
    } catch {}
  }

  return exeName
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buf.length)
  new Uint8Array(arrayBuffer).set(buf)
  return arrayBuffer
}

export class FfmpegStreamPlayer {
  private server: http.Server | null = null
  private port = 0
  private streamProc: ChildProcess | null = null
  private currentResponse: http.ServerResponse | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private filePath = ''
  private startAt = 0
  private startedAtMs = 0
  private sessionId = 0
  private stderrLog: string[] = []

  status: PlayerStatus = { state: 'idle', duration: 0, timePos: 0, filename: '' }
  onStatusChange: ((status: PlayerStatus) => void) | null = null
  onStopped: (() => void) | null = null

  async open(filePath: string): Promise<{ streamUrl: string; status: PlayerStatus }> {
    await this.closeStreamOnly()
    await this.ensureServer()

    this.filePath = filePath
    this.startAt = 0
    this.startedAtMs = Date.now()
    this.sessionId++
    this.stderrLog = []

    const duration = await this.probeDuration(filePath)
    this.status = {
      state: 'playing',
      duration,
      timePos: 0,
      filename: path.basename(filePath),
      streamUrl: this.streamUrl,
    }
    this.startPolling()
    this.onStatusChange?.(this.status)
    return { streamUrl: this.streamUrl, status: this.status }
  }

  async play(): Promise<void> {
    if (!this.filePath || this.status.state === 'playing') return
    this.startedAtMs = Date.now()
    this.startAt = this.status.timePos
    this.status.state = 'playing'
    this.sessionId++
    this.status.streamUrl = this.streamUrl
    this.onStatusChange?.(this.status)
  }

  async pause(): Promise<void> {
    if (!this.filePath || this.status.state !== 'playing') return
    this.updateTimePos()
    this.status.state = 'paused'
    await this.closeStreamOnly()
    this.onStatusChange?.(this.status)
  }

  async togglePause(): Promise<void> {
    if (this.status.state === 'playing') await this.pause()
    else await this.play()
  }

  async seek(time: number): Promise<void> {
    if (!this.filePath) return
    const nextTime = Math.max(0, Math.min(time, this.status.duration || time))
    this.startAt = nextTime
    this.startedAtMs = Date.now()
    this.status.timePos = nextTime
    this.sessionId++
    this.status.streamUrl = this.streamUrl
    await this.closeStreamOnly()
    this.onStatusChange?.(this.status)
  }

  async seekRelative(offset: number): Promise<void> {
    this.updateTimePos()
    await this.seek(this.status.timePos + offset)
  }

  async frameStep(): Promise<void> {
    this.updateTimePos()
    await this.pause()
    await this.seek(this.status.timePos + 1 / 25)
  }

  async frameBackStep(): Promise<void> {
    this.updateTimePos()
    await this.pause()
    await this.seek(this.status.timePos - 1 / 25)
  }

  async captureFrame(): Promise<ArrayBuffer> {
    if (!this.filePath) throw new Error('No video loaded')
    this.updateTimePos()
    const outPath = path.join(os.tmpdir(), `ffmpeg-frame-${Date.now()}.jpg`)
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', String(Math.max(0, this.status.timePos)),
      '-i', this.filePath,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      outPath,
    ]
    await this.runFfmpeg(args)
    const buf = fs.readFileSync(outPath)
    try { fs.unlinkSync(outPath) } catch {}
    return bufferToArrayBuffer(buf)
  }

  async resize(_bounds: Bounds): Promise<void> {
    // The video is rendered inside the renderer process; layout is handled by CSS.
  }

  async close(): Promise<void> {
    await this.closeStreamOnly()
    this.stopPolling()
    this.filePath = ''
    this.status = { state: 'idle', duration: 0, timePos: 0, filename: '' }
    this.onStatusChange?.(this.status)
  }

  private get streamUrl(): string {
    return `http://127.0.0.1:${this.port}/live.flv?session=${this.sessionId}`
  }

  private async ensureServer(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
      if (url.pathname !== '/live.flv' || !this.filePath) {
        res.statusCode = 404
        res.end()
        return
      }

      res.writeHead(200, {
        'Content-Type': 'video/x-flv',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      this.currentResponse = res
      this.startStreamProcess(res)
      req.on('close', () => {
        if (this.currentResponse === res) {
          this.closeStreamOnly()
        }
      })
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address()
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to start FLV server'))
          return
        }
        this.port = addr.port
        this.server!.off('error', reject)
        resolve()
      })
    })
  }

  private startStreamProcess(res: http.ServerResponse): void {
    if (this.status.state !== 'playing') {
      res.end()
      return
    }

    this.killStreamProcess()
    this.startedAtMs = Date.now()
    this.startAt = this.status.timePos

    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-hwaccel', 'cuda',
      '-ss', String(Math.max(0, this.startAt)),
      '-re',
      '-i', this.filePath,
      '-an',
      '-c:v', 'h264_nvenc',
      '-preset', 'p1',
      '-tune', 'll',
      '-rc', 'cbr',
      '-b:v', '5M',
      '-pix_fmt', 'yuv420p',
      '-f', 'flv',
      'pipe:1',
    ]

    const ffmpeg = findBinary('ffmpeg')
    this.stderrLog.push(`[spawn] ${ffmpeg} ${args.join(' ')}`)
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    this.streamProc = proc

    proc.stdout?.pipe(res)
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (this.streamProc === proc) this.stderrLog.push(chunk.toString())
    })
    proc.on('error', (err) => {
      if (this.streamProc === proc) {
        this.stderrLog.push(`[spawn error] ${err.message}`)
        this.status.state = 'stopped'
        this.onStatusChange?.(this.status)
        this.onStopped?.()
      }
      try { res.end() } catch {}
    })
    proc.on('exit', () => {
      if (this.streamProc === proc) {
        this.streamProc = null
        this.currentResponse = null
        if (this.status.state === 'playing') {
          this.updateTimePos()
          if (this.status.duration > 0 && this.status.timePos >= this.status.duration - 0.5) {
            this.status.state = 'stopped'
            this.onStatusChange?.(this.status)
            this.onStopped?.()
          }
        }
      }
    })
  }

  private async probeDuration(filePath: string): Promise<number> {
    const ffprobe = findBinary('ffprobe')
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]
    return new Promise((resolve) => {
      const proc = spawn(ffprobe, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
      let stdout = ''
      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.on('error', () => resolve(0))
      proc.on('exit', () => {
        const value = Number.parseFloat(stdout.trim())
        resolve(Number.isFinite(value) ? value : 0)
      })
    })
  }

  private runFfmpeg(args: string[]): Promise<void> {
    const ffmpeg = findBinary('ffmpeg')
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
      let stderr = ''
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      proc.on('error', reject)
      proc.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      })
    })
  }

  private updateTimePos(): void {
    if (this.status.state !== 'playing') return
    const elapsed = (Date.now() - this.startedAtMs) / 1000
    const nextTime = this.startAt + elapsed
    this.status.timePos = this.status.duration > 0 ? Math.min(nextTime, this.status.duration) : nextTime
  }

  private startPolling(): void {
    this.stopPolling()
    this.pollTimer = setInterval(() => {
      this.updateTimePos()
      this.onStatusChange?.(this.status)
    }, 250)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private killStreamProcess(): void {
    if (this.streamProc) {
      try { this.streamProc.kill('SIGKILL') } catch {}
      this.streamProc = null
    }
  }

  private async closeStreamOnly(): Promise<void> {
    this.killStreamProcess()
    if (this.currentResponse) {
      try { this.currentResponse.end() } catch {}
      this.currentResponse = null
    }
  }
}

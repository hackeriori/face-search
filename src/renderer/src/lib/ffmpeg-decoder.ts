import { FFmpeg } from '@ffmpeg/ffmpeg'

let ffmpeg: FFmpeg | null = null
let initPromise: Promise<void> | null = null

export async function initFfmpeg(): Promise<void> {
  if (ffmpeg) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      ffmpeg = new FFmpeg()

      ffmpeg.on('log', ({ message }) => {
        const m = message.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
        if (m) {
          _detectedDuration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
        }
      })

      const [jsBuffer, wasmBuffer] = await Promise.all([
        window.electronAPI.getFfmpegCoreFile('ffmpeg-core.js'),
        window.electronAPI.getFfmpegCoreFile('ffmpeg-core.wasm')
      ])
      const coreBlob = new Blob([jsBuffer], { type: 'text/javascript' })
      const wasmBlob = new Blob([wasmBuffer], { type: 'application/wasm' })
      const coreURL = URL.createObjectURL(coreBlob)
      const wasmURL = URL.createObjectURL(wasmBlob)

      await ffmpeg.load({ coreURL, wasmURL })
      URL.revokeObjectURL(coreURL)
      URL.revokeObjectURL(wasmURL)
    } catch (e) {
      ffmpeg = null
      initPromise = null
      throw e
    }
  })()

  return initPromise
}

let _detectedDuration = 0
let _loadedFileName = ''

export async function openVideo(filePath: string): Promise<{ duration: number }> {
  if (!ffmpeg) throw new Error('FFmpeg not initialized')

  _detectedDuration = 0
  _loadedFileName = 'input_' + Date.now()

  const fileBuffer = await window.electronAPI.readFileBuffer(filePath)
  await ffmpeg.writeFile(_loadedFileName, new Uint8Array(fileBuffer))

  await ffmpeg.exec(['-i', _loadedFileName, '-f', 'null', '-'])

  if (_detectedDuration === 0) {
    _detectedDuration = 30
  }

  return { duration: _detectedDuration }
}

export async function extractFrame(time: number): Promise<string> {
  if (!ffmpeg || !_loadedFileName) throw new Error('No video loaded')

  const outName = 'frame_' + Date.now() + '.jpg'
  const timeStr = formatTime(time)

  await ffmpeg.exec(['-ss', timeStr, '-i', _loadedFileName, '-vframes', '1', '-q:v', '2', outName])

  const data = await ffmpeg.readFile(outName)
  const src = data as Uint8Array
  const copy = new Uint8Array(src.length)
  copy.set(src)
  const blob = new Blob([copy], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)

  return url
}

export async function getVideoDuration(): Promise<number> {
  return _detectedDuration
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(7, '0')}`
}

export function isFfmpegReady(): boolean {
  return ffmpeg !== null
}

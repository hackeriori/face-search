const https = require('https')
const fs = require('fs')
const path = require('path')

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm'
const DEST = path.join(__dirname, '..', 'resources', 'ffmpeg', 'ffmpeg-core.wasm')

async function download() {
  const dir = path.dirname(DEST)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (fs.existsSync(DEST)) {
    console.log('[ffmpeg] ffmpeg-core.wasm already exists, skipping download')
    return
  }

  console.log('[ffmpeg] Downloading ffmpeg-core.wasm (~30MB)...')

  const file = fs.createWriteStream(DEST)
  return new Promise((resolve, reject) => {
    https.get(FFMPEG_CORE_URL, (response) => {
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log('[ffmpeg] Download complete')
        resolve()
      })
    }).on('error', (err) => {
      fs.unlinkSync(DEST)
      console.error('[ffmpeg] Download failed:', err.message)
      reject(err)
    })
  })
}

download().catch(() => {
  console.log('[ffmpeg] Download failed, will use CDN fallback at runtime')
})

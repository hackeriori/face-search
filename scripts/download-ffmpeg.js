const https = require('https')
const fs = require('fs')
const path = require('path')

const CORE_VERSION = '0.12.6'
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`
const DEST_DIR = path.join(__dirname, '..', 'resources', 'ffmpeg')

const FILES = [
  { name: 'ffmpeg-core.js', desc: 'ffmpeg-core JS glue (~300KB)' },
  { name: 'ffmpeg-core.wasm', desc: 'ffmpeg-core.wasm (~31MB)' }
]

async function downloadFile(name, dest) {
  const url = `${BASE_URL}/${name}`
  const tmp = dest + '.tmp'

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmp)
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(tmp)
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        fs.renameSync(tmp, dest)
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(tmp) } catch (_) {}
      reject(err)
    })
  })
}

async function download() {
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true })
  }

  let allExist = true
  for (const f of FILES) {
    if (!fs.existsSync(path.join(DEST_DIR, f.name))) {
      allExist = false
      break
    }
  }
  if (allExist) {
    console.log('[ffmpeg] All files already exist, skipping download')
    return
  }

  for (const f of FILES) {
    const dest = path.join(DEST_DIR, f.name)
    if (fs.existsSync(dest)) {
      console.log(`[ffmpeg] ${f.name} already exists, skipping`)
      continue
    }
    console.log(`[ffmpeg] Downloading ${f.desc}...`)
    try {
      await downloadFile(f.name, dest)
      console.log(`[ffmpeg] ${f.name} downloaded`)
    } catch (err) {
      console.error(`[ffmpeg] Failed to download ${f.name}: ${err.message}`)
    }
  }
}

download().catch((err) => {
  console.error('[ffmpeg] Download failed:', err.message)
})

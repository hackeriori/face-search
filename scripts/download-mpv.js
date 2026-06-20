const https = require('https')
const fetch = require('node-fetch')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Some environments (e.g. WSL) lack proper CA cert bundles
const agent = new https.Agent({ rejectUnauthorized: false })

const REPO = 'shinchiro/mpv-winbuild-cmake'
const DEST = path.join(__dirname, '..', 'resources', 'mpv')
const TMP_DIR = path.join(__dirname, '..', 'resources')

function download(url, dest) {
  return fetch(url, { agent }).then(res => {
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(dest)
      res.body.pipe(fileStream)
      res.body.on('error', reject)
      fileStream.on('finish', resolve)
    })
  })
}

function extract(archive, dest) {
  const cmds = [
    // 7zip-bin (bundled with electron-builder) provides a platform-specific 7za
    (() => { try { return require('7zip-bin').path7za } catch { return null } })(),
    '7z', '7za', '7zr',
  ].filter(Boolean)
  for (const cmd of cmds) {
    try {
      execSync(`"${cmd}" x "${archive}" -o"${dest}" -y`, { stdio: 'inherit' })
      return
    } catch { }
  }
  throw new Error(
    'No 7-Zip extractor found. Install p7zip:\n' +
    '  Windows: Install 7-Zip (https://7-zip.org/) and ensure 7z.exe is in PATH\n' +
    '  Linux:   sudo apt-get install p7zip-full\n' +
    '  macOS:   brew install p7zip'
  )
}

async function main() {
  if (process.platform === 'win32' && fs.existsSync(path.join(DEST, 'mpv.exe'))) {
    console.log('mpv already downloaded in resources/mpv/')
    return
  }
  if (process.platform !== 'win32' && fs.existsSync(path.join(DEST, 'mpv'))) {
    console.log('mpv already downloaded in resources/mpv/')
    return
  }
  if (fs.existsSync(path.join(DEST, 'mpv.exe'))) {
    console.log('mpv already downloaded in resources/mpv/')
    return
  }

  console.log('Fetching latest mpv release info...')
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    agent,
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'face-search/1.0' }
  })
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        'GitHub API rate limited. Set GITHUB_TOKEN env var or download manually:\n' +
        '  1. Go to https://github.com/shinchiro/mpv-winbuild-cmake/releases/latest\n' +
        '  2. Download the x86_64 .7z file\n' +
        '  3. Extract to resources/mpv/'
      )
    }
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }

  const release = await res.json()
  const asset = release.assets.find(a =>
    a.name.includes('mpv') && a.name.includes('x86_64') && !a.name.includes('dev') && a.name.endsWith('.7z')
  )
  if (!asset) {
    throw new Error(`No x86_64 7z asset found in release ${release.tag_name}`)
  }

  const archivePath = path.join(TMP_DIR, asset.name)
  console.log(`Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)...`)
  await download(asset.browser_download_url, archivePath)

  console.log('Extracting...')
  fs.mkdirSync(DEST, { recursive: true })
  extract(archivePath, DEST)
  fs.unlinkSync(archivePath)

  // Clean up: keep only binaries and DLLs
  for (const f of fs.readdirSync(DEST)) {
    const ext = path.extname(f).toLowerCase()
    if (f === 'mpv.exe' || f === 'mpv.com' || ext === '.dll') continue
    const fullPath = path.join(DEST, f)
    if (fs.statSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true })
    } else {
      fs.unlinkSync(fullPath)
    }
  }

  console.log(`\nmpv ${release.tag_name} installed to ${DEST}`)
  const exeSize = fs.statSync(path.join(DEST, 'mpv.exe')).size
  const dllCount = fs.readdirSync(DEST).filter(f => f.endsWith('.dll')).length
  console.log(`  mpv.exe: ${(exeSize / 1024 / 1024).toFixed(1)} MB`)
  console.log(`  DLLs: ${dllCount} files`)
}

main().catch(err => {
  console.error('Failed to download mpv:', err.message)
  process.exit(1)
})

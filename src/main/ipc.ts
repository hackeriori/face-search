import { ipcMain, clipboard, dialog, shell, BrowserWindow } from 'electron'
import { insertFaceRecord, searchSimilarFaces, getAllFaceRecords, deleteFaceRecord, searchMatchingActors, findOrCreateVideo, createActor, hasFaceRecord, getAllActorsWithRecords } from './database'
import { checkApi, representImage } from './faceApi'
import { MpvPlayer, type Bounds } from './mpv'
import fs from 'fs'
import path from 'path'

let mpvPlayer: MpvPlayer | null = null

export function setMpvPlayer(player: MpvPlayer) {
  mpvPlayer = player
}

export function registerIpcHandlers(ipc: typeof ipcMain) {

  ipc.handle('api:check', async () => {
    return checkApi()
  })

  ipc.handle('api:represent', async (_event, imageBuffer: ArrayBuffer) => {
    const buffer = Buffer.from(imageBuffer)
    return representImage(buffer)
  })

  ipc.handle('db:insertFaceRecord', async (_event, actorId: number, videoId: number) => {
    return insertFaceRecord(actorId, videoId)
  })

  ipc.handle('db:createActor', async (_event, params: {
    name?: string
    image_blob: ArrayBuffer
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
  }) => {
    const embeddingBuffer = Buffer.from(new Float32Array(params.embedding).buffer)
    const imageBuffer = Buffer.from(params.image_blob)
    return createActor({
      name: params.name,
      image_blob: imageBuffer,
      facial_area_x: params.facial_area_x,
      facial_area_y: params.facial_area_y,
      facial_area_w: params.facial_area_w,
      facial_area_h: params.facial_area_h,
      face_confidence: params.face_confidence,
      embedding: embeddingBuffer
    })
  })

  ipc.handle('db:searchFaces', async (_event, embedding: number[], maxDistance?: number) => {
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer)
    const rows = searchSimilarFaces(embeddingBuffer, maxDistance)
    return rows.map((row: any) => ({
      ...row,
      image_blob: row.image_blob.toString('base64'),
      similarity: Math.round((1 - row.distance) * 10000) / 100
    }))
  })

  ipc.handle('db:searchMatchingActors', async (_event, embedding: number[], maxDistance?: number) => {
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer)
    const candidates = searchMatchingActors(embeddingBuffer, maxDistance)
    return candidates.map(c => ({
      ...c,
      image_blob: c.image_blob.toString('base64')
    }))
  })

  ipc.handle('db:findOrCreateVideo', async (_event, videoPath: string) => {
    return findOrCreateVideo(videoPath)
  })

  ipc.handle('db:getAllActorsWithRecords', async () => {
    const actors = getAllActorsWithRecords()
    return actors.map((actor: any) => ({
      ...actor,
      image_blob: actor.image_blob ? actor.image_blob.toString('base64') : null
    }))
  })

  ipc.handle('db:hasFaceRecord', async (_event, actorId: number, videoId: number) => {
    return hasFaceRecord(actorId, videoId)
  })

  ipc.handle('db:getAllRecords', async () => {
    return getAllFaceRecords()
  })

  ipc.handle('db:deleteRecord', async (_event, id: number) => {
    return deleteFaceRecord(id)
  })

  ipc.handle('clipboard:readImage', async () => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    const pngData = image.toPNG()
    const dataUrl = `data:image/png;base64,${pngData.toString('base64')}`
    const arrayBuffer = new ArrayBuffer(pngData.length)
    new Uint8Array(arrayBuffer).set(pngData)
    return {
      buffer: arrayBuffer,
      dataUrl
    }
  })

  ipc.handle('dialog:openFile', async (_event, options: { filters?: { name: string; extensions: string[] }[] }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: options.filters || [
        { name: 'Media Files', extensions: ['mp4', 'webm', 'ogg', 'wmv', 'mkv', 'avi', 'mov', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] },
        { name: 'Video Files', extensions: ['mp4', 'webm', 'ogg', 'wmv', 'mkv', 'avi', 'mov'] },
        { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }
      ]
    })
  })

  ipc.handle('file:readAsDataUrl', async (_event, filePath: string) => {
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo'
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    const arrayBuffer = new ArrayBuffer(buffer.length)
    new Uint8Array(arrayBuffer).set(buffer)
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      buffer: arrayBuffer
    }
  })

  ipc.handle('file:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath)
  })

  ipc.handle('shell:openPath', async (_event, filePath: string) => {
    return shell.openPath(filePath)
  })

  ipc.handle('file:readBuffer', async (_event, filePath: string) => {
    const buffer = fs.readFileSync(filePath)
    const arrayBuffer = new ArrayBuffer(buffer.length)
    new Uint8Array(arrayBuffer).set(buffer)
    return arrayBuffer
  })

  // --- MPV Player IPC ---
  ipc.handle('mpv:open', async (_event, filePath: string, bounds?: Bounds) => {
    if (!mpvPlayer) throw new Error('MPV player not initialized')
    await mpvPlayer.open(filePath, bounds)
  })

  ipc.handle('mpv:close', async () => {
    await mpvPlayer?.close()
  })

  ipc.handle('mpv:play', async () => {
    await mpvPlayer?.play()
  })

  ipc.handle('mpv:pause', async () => {
    await mpvPlayer?.pause()
  })

  ipc.handle('mpv:togglePause', async () => {
    await mpvPlayer?.togglePause()
  })

  ipc.handle('mpv:seek', async (_event, time: number) => {
    await mpvPlayer?.seek(time)
  })

  ipc.handle('mpv:seekRelative', async (_event, offset: number) => {
    await mpvPlayer?.seekRelative(offset)
  })

  ipc.handle('mpv:frameStep', async () => {
    await mpvPlayer?.frameStep()
  })

  ipc.handle('mpv:frameBackStep', async () => {
    await mpvPlayer?.frameBackStep()
  })

  ipc.handle('mpv:captureFrame', async () => {
    if (!mpvPlayer) throw new Error('MPV player not initialized')
    const buffer = await mpvPlayer.captureFrame()
    const blob = Buffer.from(buffer)
    const dataUrl = `data:image/jpeg;base64,${blob.toString('base64')}`
    const arrayBuffer = new ArrayBuffer(blob.length)
    new Uint8Array(arrayBuffer).set(blob)
    return { buffer: arrayBuffer, dataUrl }
  })

  ipc.handle('mpv:getStatus', async () => {
    return mpvPlayer?.status || null
  })

  ipc.handle('mpv:resize', async (_event, bounds: Bounds) => {
    await mpvPlayer?.resize(bounds)
  })

  ipc.handle('mpv:onStatus', (_event) => {
    if (!mpvPlayer) return
    mpvPlayer.onStatusChange = (status) => {
      const win = BrowserWindow.getFocusedWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('mpv:statusUpdate', status)
      }
    }
  })

  ipc.handle('mpv:onStopped', (_event) => {
    if (!mpvPlayer) return
    const handler = () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('mpv:stopped')
      }
    }
    mpvPlayer.onStopped = handler
  })
}

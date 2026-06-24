import { ipcMain, clipboard, dialog, shell, BrowserWindow } from 'electron'
import { insertFaceRecord, searchSimilarFaces, deleteVideo, deleteOrphanActors, searchMatchingActors, findOrCreateVideo, createActor, addActorFace, hasFaceRecord, getAllActorsWithRecords, getActorFaces, deleteActorFace, mergeActors, renameActor } from './database'
import { checkApi, representImage } from './faceApi'
import { FfmpegStreamPlayer, type Bounds } from './ffmpegStream'
import fs from 'fs'
import path from 'path'

let player: FfmpegStreamPlayer | null = null

export function setPlayer(ffmpegPlayer: FfmpegStreamPlayer) {
  player = ffmpegPlayer
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

  ipc.handle('db:createActor', async (_event, params: { name?: string }) => {
    return createActor(params.name)
  })

  ipc.handle('db:addActorFace', async (_event, actorId: number, params: {
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
    return addActorFace(actorId, {
      image_blob: imageBuffer,
      facial_area_x: params.facial_area_x,
      facial_area_y: params.facial_area_y,
      facial_area_w: params.facial_area_w,
      facial_area_h: params.facial_area_h,
      face_confidence: params.face_confidence,
      embedding: embeddingBuffer
    })
  })

  ipc.handle('db:getActorFaces', async (_event, actorId: number) => {
    const rows = getActorFaces(actorId)
    return rows.map(row => ({
      ...row,
      image_blob: row.image_blob ? row.image_blob.toString('base64') : null
    }))
  })

  ipc.handle('db:deleteActorFace', async (_event, faceId: number) => {
    return deleteActorFace(faceId)
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

  ipc.handle('db:deleteVideo', async (_event, videoId: number) => {
    return deleteVideo(videoId)
  })

  ipc.handle('db:mergeActors', async (_event, sourceActorId: number, targetActorId: number) => {
    return mergeActors(sourceActorId, targetActorId)
  })

  ipc.handle('db:renameActor', async (_event, actorId: number, name: string) => {
    return renameActor(actorId, name)
  })

  ipc.handle('db:deleteOrphanActors', async () => {
    return deleteOrphanActors()
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

  // --- FFmpeg FLV Player IPC ---
  ipc.handle('player:open', async (_event, filePath: string, _bounds?: Bounds) => {
    if (!player) throw new Error('FFmpeg player not initialized')
    return player.open(filePath)
  })

  ipc.handle('player:close', async () => {
    await player?.close()
  })

  ipc.handle('player:play', async () => {
    await player?.play()
  })

  ipc.handle('player:pause', async () => {
    await player?.pause()
  })

  ipc.handle('player:togglePause', async () => {
    await player?.togglePause()
  })

  ipc.handle('player:seek', async (_event, time: number) => {
    await player?.seek(time)
  })

  ipc.handle('player:seekRelative', async (_event, offset: number) => {
    await player?.seekRelative(offset)
  })

  ipc.handle('player:frameStep', async () => {
    await player?.frameStep()
  })

  ipc.handle('player:frameBackStep', async () => {
    await player?.frameBackStep()
  })

  ipc.handle('player:captureFrame', async () => {
    if (!player) throw new Error('FFmpeg player not initialized')
    const buffer = await player.captureFrame()
    const blob = Buffer.from(buffer)
    const dataUrl = `data:image/jpeg;base64,${blob.toString('base64')}`
    const arrayBuffer = new ArrayBuffer(blob.length)
    new Uint8Array(arrayBuffer).set(blob)
    return { buffer: arrayBuffer, dataUrl }
  })

  ipc.handle('player:captureFrameAt', async (_event, time: number) => {
    if (!player) throw new Error('FFmpeg player not initialized')
    const buffer = await player.captureFrameAt(time)
    const blob = Buffer.from(buffer)
    const dataUrl = `data:image/jpeg;base64,${blob.toString('base64')}`
    const arrayBuffer = new ArrayBuffer(blob.length)
    new Uint8Array(arrayBuffer).set(blob)
    return { buffer: arrayBuffer, dataUrl }
  })

  ipc.handle('player:getStatus', async () => {
    return player?.status || null
  })

  ipc.handle('player:resize', async (_event, bounds: Bounds) => {
    await player?.resize(bounds)
  })

  ipc.handle('player:onStatus', (_event) => {
    if (!player) return
    player.onStatusChange = (status) => {
      const win = BrowserWindow.getFocusedWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('player:statusUpdate', status)
      }
    }
  })

  ipc.handle('player:onStopped', (_event) => {
    if (!player) return
    const handler = () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('player:stopped')
      }
    }
    player.onStopped = handler
  })

}

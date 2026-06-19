import { ipcMain, clipboard, dialog, shell, BrowserWindow } from 'electron'
import { insertFaceRecord, searchSimilarFaces, getAllFaceRecords, deleteFaceRecord } from './database'
import { checkApi, representImage } from './faceApi'
import fs from 'fs'
import path from 'path'

export function registerIpcHandlers(ipc: typeof ipcMain) {

  ipc.handle('api:check', async () => {
    return checkApi()
  })

  ipc.handle('api:represent', async (_event, imageBuffer: ArrayBuffer) => {
    const buffer = Buffer.from(imageBuffer)
    return representImage(buffer)
  })

  ipc.handle('db:insertFace', async (_event, params: {
    video_path: string
    image_blob: ArrayBuffer
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
    note?: string
  }) => {
    const embeddingBuffer = Buffer.from(new Float32Array(params.embedding).buffer)
    const imageBuffer = Buffer.from(params.image_blob)
    return insertFaceRecord({
      video_path: params.video_path,
      image_blob: imageBuffer,
      facial_area_x: params.facial_area_x,
      facial_area_y: params.facial_area_y,
      facial_area_w: params.facial_area_w,
      facial_area_h: params.facial_area_h,
      face_confidence: params.face_confidence,
      embedding: embeddingBuffer,
      note: params.note
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

  ipc.handle('db:getAllRecords', async () => {
    const rows = getAllFaceRecords()
    return rows.map((row: any) => ({
      ...row,
      image_blob: row.image_blob.toString('base64')
    }))
  })

  ipc.handle('db:deleteRecord', async (_event, id: number) => {
    return deleteFaceRecord(id)
  })

  ipc.handle('clipboard:readImage', async () => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    const pngData = image.toPNG()
    const dataUrl = `data:image/png;base64,${pngData.toString('base64')}`
    return {
      buffer: pngData.buffer,
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
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      buffer: buffer.buffer
    }
  })

  ipc.handle('file:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath)
  })

  ipc.handle('shell:openPath', async (_event, filePath: string) => {
    return shell.openPath(filePath)
  })
}

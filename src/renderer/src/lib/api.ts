import type { ApiCheckResult, SearchResult, DetectedFace } from './types'

export async function checkApi(): Promise<ApiCheckResult> {
  return window.electronAPI.checkApi()
}

export async function representImage(imageDataUrl: string): Promise<{ result: DetectedFace[] }> {
  const response = await fetch(imageDataUrl)
  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  return window.electronAPI.representImage(buffer)
}

export async function insertFace(params: {
  video_path: string
  image_blob: ArrayBuffer | Uint8Array
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: number[]
}): Promise<number> {
  return window.electronAPI.insertFace(params)
}

export async function searchFaces(embedding: number[], maxDistance?: number): Promise<SearchResult[]> {
  return window.electronAPI.searchFaces(embedding, maxDistance)
}

export async function getAllRecords(): Promise<any[]> {
  return window.electronAPI.getAllRecords()
}

export async function deleteRecord(id: number): Promise<boolean> {
  return window.electronAPI.deleteRecord(id)
}

export async function readClipboardImage(): Promise<{ buffer: ArrayBuffer; dataUrl: string } | null> {
  return window.electronAPI.readClipboardImage()
}

export async function openFile(options?: any): Promise<{ canceled: boolean; filePaths: string[] }> {
  return window.electronAPI.openFile(options)
}

export async function readFileAsDataUrl(filePath: string): Promise<{ dataUrl: string; buffer: ArrayBuffer }> {
  return window.electronAPI.readFileAsDataUrl(filePath)
}

export async function fileExists(filePath: string): Promise<boolean> {
  return window.electronAPI.fileExists(filePath)
}

export async function openPath(filePath: string): Promise<string> {
  return window.electronAPI.openPath(filePath)
}

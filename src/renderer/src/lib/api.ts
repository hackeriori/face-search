import type {
  ApiCheckResult, SearchResult, DetectedFace, ActorGroup, PaginatedActorGroups, AddActorFaceParams, ActorFace,
  ActorMatchCandidate, ActorVideoCounts
} from './types'

export async function checkApi(): Promise<ApiCheckResult> {
  return window.electronAPI.checkApi()
}

export async function representImage(imageDataUrl: string): Promise<{result: DetectedFace[]}> {
  const response = await fetch(imageDataUrl)
  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  return window.electronAPI.representImage(buffer)
}

export async function insertFaceRecord(actorId: number, videoId: number): Promise<number> {
  return window.electronAPI.insertFaceRecord(actorId, videoId)
}

export async function createActor(params: {name?: string}): Promise<number> {
  return window.electronAPI.createActor(params)
}

export async function addActorFace(actorId: number, params: AddActorFaceParams): Promise<number> {
  return window.electronAPI.addActorFace(actorId, params)
}

export async function getActorFaces(actorId: number): Promise<ActorFace[]> {
  return window.electronAPI.getActorFaces(actorId)
}

export async function deleteActorFace(faceId: number): Promise<boolean> {
  return window.electronAPI.deleteActorFace(faceId)
}

export async function searchFaces(embedding: number[], maxDistance?: number): Promise<SearchResult[]> {
  return window.electronAPI.searchFaces(embedding, maxDistance)
}

export async function searchMatchingActors(embedding: number[], maxDistance?: number): Promise<ActorMatchCandidate[]> {
  return window.electronAPI.searchMatchingActors(embedding, maxDistance)
}

export async function findOrCreateVideo(videoPath: string): Promise<number> {
  return window.electronAPI.findOrCreateVideo(videoPath)
}

export async function hasFaceRecord(actorId: number, videoId: number): Promise<boolean> {
  return window.electronAPI.hasFaceRecord(actorId, videoId)
}

export async function getAllActorsWithRecords(page?: number, pageSize?: number, searchQuery?: string): Promise<PaginatedActorGroups> {
  return window.electronAPI.getAllActorsWithRecords(page, pageSize, searchQuery)
}

export async function countActorsAndVideos(searchQuery?: string): Promise<ActorVideoCounts> {
  return window.electronAPI.countActorsAndVideos(searchQuery)
}

export async function mergeActors(sourceActorId: number, targetActorId: number): Promise<void> {
  return window.electronAPI.mergeActors(sourceActorId, targetActorId)
}

export async function renameActor(actorId: number, name: string): Promise<boolean> {
  return window.electronAPI.renameActor(actorId, name)
}

export async function deleteVideo(videoId: number): Promise<boolean> {
  return window.electronAPI.deleteVideo(videoId)
}

export async function deleteOrphanActors(): Promise<number> {
  return window.electronAPI.deleteOrphanActors()
}

export async function readClipboardImage(): Promise<{buffer: ArrayBuffer; dataUrl: string} | null> {
  return window.electronAPI.readClipboardImage()
}

export async function openFile(options?: any): Promise<{canceled: boolean; filePaths: string[]}> {
  return window.electronAPI.openFile(options)
}

export async function readFileAsDataUrl(filePath: string): Promise<{dataUrl: string; buffer: ArrayBuffer}> {
  return window.electronAPI.readFileAsDataUrl(filePath)
}

export async function fileExists(filePath: string): Promise<boolean> {
  return window.electronAPI.fileExists(filePath)
}

export async function openPath(filePath: string): Promise<string> {
  return window.electronAPI.openPath(filePath)
}

import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  checkApi: (): Promise<any> => ipcRenderer.invoke('api:check'),
  representImage: (imageBuffer: ArrayBuffer): Promise<any> => ipcRenderer.invoke('api:represent', imageBuffer),

  insertFaceRecord: (actorId: number, videoId: number): Promise<number> =>
    ipcRenderer.invoke('db:insertFaceRecord', actorId, videoId),

  createActor: (params: { name?: string }): Promise<number> =>
    ipcRenderer.invoke('db:createActor', params),

  addActorFace: (actorId: number, params: {
    image_blob: ArrayBuffer | Uint8Array
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
  }): Promise<number> => ipcRenderer.invoke('db:addActorFace', actorId, params),

  getActorFaces: (actorId: number): Promise<any[]> =>
    ipcRenderer.invoke('db:getActorFaces', actorId),

  deleteActorFace: (faceId: number): Promise<boolean> =>
    ipcRenderer.invoke('db:deleteActorFace', faceId),

  searchFaces: (embedding: number[], maxDistance?: number): Promise<any[]> =>
    ipcRenderer.invoke('db:searchFaces', embedding, maxDistance),

  searchMatchingActors: (embedding: number[], maxDistance?: number): Promise<any[]> =>
    ipcRenderer.invoke('db:searchMatchingActors', embedding, maxDistance),

  findOrCreateVideo: (videoPath: string): Promise<number> =>
    ipcRenderer.invoke('db:findOrCreateVideo', videoPath),

  hasFaceRecord: (actorId: number, videoId: number): Promise<boolean> =>
    ipcRenderer.invoke('db:hasFaceRecord', actorId, videoId),

  getAllActorsWithRecords: (page?: number, pageSize?: number, searchQuery?: string): Promise<any> =>
    ipcRenderer.invoke('db:getAllActorsWithRecords', page, pageSize, searchQuery),

  deleteVideo: (videoId: number): Promise<boolean> => ipcRenderer.invoke('db:deleteVideo', videoId),

  mergeActors: (sourceActorId: number, targetActorId: number): Promise<void> =>
    ipcRenderer.invoke('db:mergeActors', sourceActorId, targetActorId),

  renameActor: (actorId: number, name: string): Promise<boolean> =>
    ipcRenderer.invoke('db:renameActor', actorId, name),

  deleteOrphanActors: (): Promise<number> => ipcRenderer.invoke('db:deleteOrphanActors'),

  readClipboardImage: (): Promise<{ buffer: ArrayBuffer; dataUrl: string } | null> =>
    ipcRenderer.invoke('clipboard:readImage'),

  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('dialog:openFile', options),

  readFileAsDataUrl: (filePath: string): Promise<{ dataUrl: string; buffer: ArrayBuffer }> =>
    ipcRenderer.invoke('file:readAsDataUrl', filePath),

  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filePath),

  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', filePath),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  // --- FFmpeg FLV Player API ---
  playerOpen: (filePath: string, bounds?: { x: number; y: number; w: number; h: number }): Promise<{ streamUrl: string; status: any }> =>
    ipcRenderer.invoke('player:open', filePath, bounds),

  playerClose: (): Promise<void> => ipcRenderer.invoke('player:close'),

  playerPlay: (): Promise<void> => ipcRenderer.invoke('player:play'),

  playerPause: (): Promise<void> => ipcRenderer.invoke('player:pause'),

  playerTogglePause: (): Promise<void> => ipcRenderer.invoke('player:togglePause'),

  playerSeek: (time: number): Promise<void> => ipcRenderer.invoke('player:seek', time),

  playerSeekRelative: (offset: number): Promise<void> => ipcRenderer.invoke('player:seekRelative', offset),

  playerFrameStep: (): Promise<void> => ipcRenderer.invoke('player:frameStep'),

  playerFrameBackStep: (): Promise<void> => ipcRenderer.invoke('player:frameBackStep'),

  playerCaptureFrame: (): Promise<{ buffer: ArrayBuffer; dataUrl: string }> =>
    ipcRenderer.invoke('player:captureFrame'),

  playerCaptureFrameAt: (time: number): Promise<{ buffer: ArrayBuffer; dataUrl: string }> =>
    ipcRenderer.invoke('player:captureFrameAt', time),

  playerGetStatus: (): Promise<{ state: string; duration: number; timePos: number; filename: string; streamUrl?: string } | null> =>
    ipcRenderer.invoke('player:getStatus'),

  playerResize: (bounds: { x: number; y: number; w: number; h: number }): Promise<void> =>
    ipcRenderer.invoke('player:resize', bounds),

  playerPauseTime: (): Promise<void> => ipcRenderer.invoke('player:pauseTime'),

  playerResumeTime: (): Promise<void> => ipcRenderer.invoke('player:resumeTime'),

  playerOnStatus: (callback: (status: any) => void): void => {
    ipcRenderer.invoke('player:onStatus')
    ipcRenderer.on('player:statusUpdate', (_event, status) => callback(status))
  },

  playerOnStopped: (callback: () => void): void => {
    ipcRenderer.invoke('player:onStopped')
    ipcRenderer.on('player:stopped', () => callback())
  },

}

contextBridge.exposeInMainWorld('electronAPI', api)

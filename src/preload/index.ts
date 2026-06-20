import { contextBridge, ipcRenderer } from 'electron'

const api = {
  checkApi: (): Promise<any> => ipcRenderer.invoke('api:check'),
  representImage: (imageBuffer: ArrayBuffer): Promise<any> => ipcRenderer.invoke('api:represent', imageBuffer),

  insertFaceRecord: (actorId: number, videoId: number): Promise<number> =>
    ipcRenderer.invoke('db:insertFaceRecord', actorId, videoId),

  createActor: (params: {
    name?: string
    image_blob: ArrayBuffer | Uint8Array
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
  }): Promise<number> => ipcRenderer.invoke('db:createActor', params),

  searchFaces: (embedding: number[], maxDistance?: number): Promise<any[]> =>
    ipcRenderer.invoke('db:searchFaces', embedding, maxDistance),

  searchMatchingActors: (embedding: number[], maxDistance?: number): Promise<any[]> =>
    ipcRenderer.invoke('db:searchMatchingActors', embedding, maxDistance),

  findOrCreateVideo: (videoPath: string): Promise<number> =>
    ipcRenderer.invoke('db:findOrCreateVideo', videoPath),

  hasFaceRecord: (actorId: number, videoId: number): Promise<boolean> =>
    ipcRenderer.invoke('db:hasFaceRecord', actorId, videoId),

  getAllActorsWithRecords: (): Promise<any[]> => ipcRenderer.invoke('db:getAllActorsWithRecords'),

  deleteVideo: (videoId: number): Promise<boolean> => ipcRenderer.invoke('db:deleteVideo', videoId),

  deleteOrphanActors: (): Promise<number> => ipcRenderer.invoke('db:deleteOrphanActors'),

  readClipboardImage: (): Promise<{ buffer: ArrayBuffer; dataUrl: string } | null> =>
    ipcRenderer.invoke('clipboard:readImage'),

  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('dialog:openFile', options),

  readFileAsDataUrl: (filePath: string): Promise<{ dataUrl: string; buffer: ArrayBuffer }> =>
    ipcRenderer.invoke('file:readAsDataUrl', filePath),

  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filePath),

  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', filePath),

  // --- MPV Player API ---
  mpvOpen: (filePath: string, bounds?: { x: number; y: number; w: number; h: number }): Promise<void> =>
    ipcRenderer.invoke('mpv:open', filePath, bounds),

  mpvClose: (): Promise<void> => ipcRenderer.invoke('mpv:close'),

  mpvPlay: (): Promise<void> => ipcRenderer.invoke('mpv:play'),

  mpvPause: (): Promise<void> => ipcRenderer.invoke('mpv:pause'),

  mpvTogglePause: (): Promise<void> => ipcRenderer.invoke('mpv:togglePause'),

  mpvSeek: (time: number): Promise<void> => ipcRenderer.invoke('mpv:seek', time),

  mpvSeekRelative: (offset: number): Promise<void> => ipcRenderer.invoke('mpv:seekRelative', offset),

  mpvFrameStep: (): Promise<void> => ipcRenderer.invoke('mpv:frameStep'),

  mpvFrameBackStep: (): Promise<void> => ipcRenderer.invoke('mpv:frameBackStep'),

  mpvCaptureFrame: (): Promise<{ buffer: ArrayBuffer; dataUrl: string }> =>
    ipcRenderer.invoke('mpv:captureFrame'),

  mpvGetStatus: (): Promise<{ state: string; duration: number; timePos: number; filename: string } | null> =>
    ipcRenderer.invoke('mpv:getStatus'),

  mpvResize: (bounds: { x: number; y: number; w: number; h: number }): Promise<void> =>
    ipcRenderer.invoke('mpv:resize', bounds),

  mpvOnStatus: (callback: (status: any) => void): void => {
    ipcRenderer.invoke('mpv:onStatus')
    ipcRenderer.on('mpv:statusUpdate', (_event, status) => callback(status))
  },

  mpvOnStopped: (callback: () => void): void => {
    ipcRenderer.invoke('mpv:onStopped')
    ipcRenderer.on('mpv:stopped', () => callback())
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

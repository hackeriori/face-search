import { contextBridge, ipcRenderer } from 'electron'

const api = {
  checkApi: (): Promise<any> => ipcRenderer.invoke('api:check'),
  representImage: (imageBuffer: ArrayBuffer): Promise<any> => ipcRenderer.invoke('api:represent', imageBuffer),

  insertFace: (params: {
    video_path: string
    image_blob: ArrayBuffer
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
    note?: string
  }): Promise<number> => ipcRenderer.invoke('db:insertFace', params),

  searchFaces: (embedding: number[], maxDistance?: number): Promise<any[]> =>
    ipcRenderer.invoke('db:searchFaces', embedding, maxDistance),

  getAllRecords: (): Promise<any[]> => ipcRenderer.invoke('db:getAllRecords'),

  deleteRecord: (id: number): Promise<boolean> => ipcRenderer.invoke('db:deleteRecord', id),

  readClipboardImage: (): Promise<{ buffer: ArrayBuffer; dataUrl: string } | null> =>
    ipcRenderer.invoke('clipboard:readImage'),

  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('dialog:openFile', options),

  readFileAsDataUrl: (filePath: string): Promise<{ dataUrl: string; buffer: ArrayBuffer }> =>
    ipcRenderer.invoke('file:readAsDataUrl', filePath),

  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filePath),

  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', filePath)
}

contextBridge.exposeInMainWorld('electronAPI', api)

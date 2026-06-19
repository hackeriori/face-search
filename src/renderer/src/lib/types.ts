export interface FaceArea {
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedFace {
  embedding: number[]
  facial_area: FaceArea
  face_confidence: number
  selected?: boolean
}

export interface ApiCheckResult {
  result: string
  title: string
  help: string
  detector_backend: string
  recognition_model: string
  facial_min_score: number
  facial_max_distance: number
}

export interface SearchResult {
  id: number
  video_path: string
  image_blob: string
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  created_at: string
  note: string | null
  distance: number
  similarity: number
}

export interface ElectronAPI {
  checkApi: () => Promise<ApiCheckResult>
  representImage: (imageBuffer: ArrayBuffer) => Promise<{ result: DetectedFace[] }>
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
  }) => Promise<number>
  searchFaces: (embedding: number[], maxDistance?: number) => Promise<SearchResult[]>
  getAllRecords: () => Promise<any[]>
  deleteRecord: (id: number) => Promise<boolean>
  readClipboardImage: () => Promise<{ buffer: ArrayBuffer; dataUrl: string } | null>
  openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  readFileAsDataUrl: (filePath: string) => Promise<{ dataUrl: string; buffer: ArrayBuffer }>
  fileExists: (filePath: string) => Promise<boolean>
  openPath: (filePath: string) => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

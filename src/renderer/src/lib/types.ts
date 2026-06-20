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

export interface ActorInfo {
  id: number
  name: string | null
  created_at: string
}

export interface ActorMatchCandidate {
  actor_id: number
  distance: number
  similarity: number
  image_blob: string
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
}

export interface SearchResult {
  id: number
  actor_id: number
  video_id: number
  video_path: string
  image_blob: string
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  created_at: string
  distance: number
  similarity: number
}

export interface SearchResultGroup {
  actor_id: number
  items: SearchResult[]
  best_match: SearchResult
}

export interface FaceRecord {
  id: number
  actor_id: number
  video_id: number
  video_path: string
  image_blob: string
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  created_at: string
}

export interface ActorGroup {
  actor_id: number
  records: FaceRecord[]
  total_videos: number
}

export interface MpvBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface MpvStatusInfo {
  state: 'playing' | 'paused' | 'stopped' | 'idle'
  duration: number
  timePos: number
  filename: string
}

export interface ElectronAPI {
  checkApi: () => Promise<ApiCheckResult>
  representImage: (imageBuffer: ArrayBuffer) => Promise<{ result: DetectedFace[] }>
  insertFace: (params: {
    actor_id: number
    video_id: number
    image_blob: ArrayBuffer | Uint8Array
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
  }) => Promise<number>
  searchFaces: (embedding: number[], maxDistance?: number) => Promise<SearchResult[]>
  getAllRecords: () => Promise<FaceRecord[]>
  deleteRecord: (id: number) => Promise<boolean>
  searchMatchingActors: (embedding: number[], maxDistance?: number) => Promise<ActorMatchCandidate[]>
  findOrCreateVideo: (videoPath: string) => Promise<number>
  createActor: () => Promise<number>
  hasFaceRecord: (actorId: number, videoId: number) => Promise<boolean>
  readClipboardImage: () => Promise<{ buffer: ArrayBuffer; dataUrl: string } | null>
  openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  readFileAsDataUrl: (filePath: string) => Promise<{ dataUrl: string; buffer: ArrayBuffer }>
  fileExists: (filePath: string) => Promise<boolean>
  openPath: (filePath: string) => Promise<string>
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer>
  // --- MPV Player ---
  mpvOpen: (filePath: string, bounds?: MpvBounds) => Promise<void>
  mpvClose: () => Promise<void>
  mpvPlay: () => Promise<void>
  mpvPause: () => Promise<void>
  mpvTogglePause: () => Promise<void>
  mpvSeek: (time: number) => Promise<void>
  mpvSeekRelative: (offset: number) => Promise<void>
  mpvFrameStep: () => Promise<void>
  mpvFrameBackStep: () => Promise<void>
  mpvCaptureFrame: () => Promise<{ buffer: ArrayBuffer; dataUrl: string }>
  mpvGetStatus: () => Promise<MpvStatusInfo | null>
  mpvResize: (bounds: MpvBounds) => Promise<void>
  mpvOnStatus: (callback: (status: MpvStatusInfo) => void) => void
  mpvOnStopped: (callback: () => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

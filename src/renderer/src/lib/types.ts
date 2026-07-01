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

export interface ActorMatchCandidate {
  actor_id: number
  name: string | null
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
  name: string | null
  video_id: number
  video_path: string
  image_blob: string
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  distance: number
  similarity: number
}

export interface SearchResultGroup {
  actor_id: number
  name: string | null
  items: SearchResult[]
  best_match: SearchResult
}

export interface FaceSearchResultGroup {
  faceIndex: number
  faceLabel: string
  facial_area: FaceArea
  results: SearchResult[]
}

export interface ActorRecord {
  id: number
  video_id: number
  video_path: string
}

export interface ActorGroup {
  actor_id: number
  name: string | null
  image_blob: string | null
  facial_area_x: number | null
  facial_area_y: number | null
  facial_area_w: number | null
  facial_area_h: number | null
  face_confidence: number | null
  records: ActorRecord[]
}

export interface ActorVideoCounts {
  totalActors: number
  totalVideos: number
}

export interface PaginatedActorGroups {
  data: ActorGroup[]
  total: number
  totalVideos: number
}

export interface ActorFace {
  id: number
  actor_id: number
  image_blob: string | null
  facial_area_x: number | null
  facial_area_y: number | null
  facial_area_w: number | null
  facial_area_h: number | null
  face_confidence: number | null
}

export interface AddActorFaceParams {
  image_blob: ArrayBuffer | Uint8Array
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: number[]
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
  streamUrl?: string
}

export interface ElectronAPI {
  checkApi: () => Promise<ApiCheckResult>
  representImage: (imageBuffer: ArrayBuffer) => Promise<{ result: DetectedFace[] }>
  insertFaceRecord: (actorId: number, videoId: number) => Promise<number>
  createActor: (params: { name?: string }) => Promise<number>
  addActorFace: (actorId: number, params: AddActorFaceParams) => Promise<number>
  getActorFaces: (actorId: number) => Promise<ActorFace[]>
  deleteActorFace: (faceId: number) => Promise<boolean>
  searchFaces: (embedding: number[], maxDistance?: number) => Promise<SearchResult[]>
  getAllActorsWithRecords: (page?: number, pageSize?: number, searchQuery?: string) => Promise<PaginatedActorGroups>
  countActorsAndVideos: (searchQuery?: string) => Promise<ActorVideoCounts>
  mergeActors: (sourceActorId: number, targetActorId: number) => Promise<void>
  renameActor: (actorId: number, name: string) => Promise<boolean>
  deleteVideo: (videoId: number) => Promise<boolean>
  deleteOrphanActors: () => Promise<number>
  searchMatchingActors: (embedding: number[], maxDistance?: number) => Promise<ActorMatchCandidate[]>
  findOrCreateVideo: (videoPath: string) => Promise<number>
  hasFaceRecord: (actorId: number, videoId: number) => Promise<boolean>
  readClipboardImage: () => Promise<{ buffer: ArrayBuffer; dataUrl: string } | null>
  openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  readFileAsDataUrl: (filePath: string) => Promise<{ dataUrl: string; buffer: ArrayBuffer }>
  fileExists: (filePath: string) => Promise<boolean>
  openPath: (filePath: string) => Promise<string>
  getPathForFile: (file: File) => string
  // --- FFmpeg FLV Player ---
  playerOpen: (filePath: string, bounds?: MpvBounds) => Promise<{ streamUrl: string; status: MpvStatusInfo }>
  playerClose: () => Promise<void>
  playerPlay: () => Promise<void>
  playerPause: () => Promise<void>
  playerTogglePause: () => Promise<void>
  playerSeek: (time: number) => Promise<void>
  playerSeekRelative: (offset: number) => Promise<void>
  playerFrameStep: () => Promise<void>
  playerFrameBackStep: () => Promise<void>
  playerPauseTime: () => Promise<void>
  playerResumeTime: () => Promise<void>
  playerCaptureFrame: () => Promise<{ buffer: ArrayBuffer; dataUrl: string }>
  playerCaptureFrameAt: (time: number) => Promise<{ buffer: ArrayBuffer; dataUrl: string }>
  playerGetStatus: () => Promise<MpvStatusInfo | null>
  playerResize: (bounds: MpvBounds) => Promise<void>
  playerOnStatus: (callback: (status: MpvStatusInfo) => void) => void
  playerOnStopped: (callback: () => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function initDatabase(dbPath: string): Database.Database {
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  loadVecExtension(db)

  db.exec(`
    CREATE TABLE IF NOT EXISTS face_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_path VARCHAR(255) NOT NULL,
      image_blob BLOB NOT NULL,
      facial_area_x INTEGER NOT NULL,
      facial_area_y INTEGER NOT NULL,
      facial_area_w INTEGER NOT NULL,
      facial_area_h INTEGER NOT NULL,
      face_confidence REAL NOT NULL,
      embedding F32_BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_video_path ON face_records(video_path);
  `)

  return db
}

function loadVecExtension(database: Database.Database) {
  const possiblePaths = [
    path.join(app.getAppPath(), 'node_modules', 'sqlite-vec', 'dist', 'vec0.o'),
    path.join(app.getAppPath(), 'node_modules', 'sqlite-vec', 'dist', 'vec0.so'),
    path.join(app.getAppPath(), 'node_modules', 'sqlite-vec', 'dist', 'vec0.dylib'),
    path.join(app.getAppPath(), 'node_modules', 'sqlite-vec', 'dist', 'vec0.dll'),
  ]

  for (const p of possiblePaths) {
    try {
      database.loadExtension(p)
      return
    } catch {
      continue
    }
  }

  console.warn('[database] sqlite-vec extension not loaded via loadExtension, trying built-in...')
  try {
    const sqVec = require('sqlite-vec')
    sqVec.load(db)
  } catch (e) {
    console.warn('[database] sqlite-vec not available:', e)
  }
}

export function getDatabase(): Database.Database | null {
  return db
}

export interface FaceRecord {
  id: number
  video_path: string
  image_blob: Buffer
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: Buffer
  created_at: string
}

export interface FaceInsertParams {
  video_path: string
  image_blob: Buffer
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: Buffer
}

export function insertFaceRecord(params: FaceInsertParams): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO face_records (video_path, image_blob, facial_area_x, facial_area_y, facial_area_w, facial_area_h, face_confidence, embedding)
    VALUES (@video_path, @image_blob, @facial_area_x, @facial_area_y, @facial_area_w, @facial_area_h, @face_confidence, @embedding)
  `)
  const result = stmt.run({
    video_path: params.video_path,
    image_blob: params.image_blob,
    facial_area_x: params.facial_area_x,
    facial_area_y: params.facial_area_y,
    facial_area_w: params.facial_area_w,
    facial_area_h: params.facial_area_h,
    face_confidence: params.face_confidence,
    embedding: params.embedding
  })
  return Number(result.lastInsertRowid)
}

export function searchSimilarFaces(embedding: Buffer, maxDistance: number = 0.5): any[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    SELECT
      id, video_path, image_blob, facial_area_x, facial_area_y,
      facial_area_w, facial_area_h, face_confidence, created_at,
      vec_distance_cosine(embedding, ?) AS distance
    FROM face_records
    WHERE vec_distance_cosine(embedding, ?) <= ?
    ORDER BY distance ASC
    LIMIT 50
  `).all(embedding, embedding, maxDistance)

  return rows
}

export function getAllFaceRecords(): FaceRecord[] {
  if (!db) throw new Error('Database not initialized')
  return db.prepare('SELECT * FROM face_records ORDER BY created_at DESC').all() as FaceRecord[]
}

export function deleteFaceRecord(id: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM face_records WHERE id = ?').run(id)
  return result.changes > 0
}

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
    CREATE TABLE IF NOT EXISTS actors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path VARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS face_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      image_blob BLOB NOT NULL,
      facial_area_x INTEGER NOT NULL,
      facial_area_y INTEGER NOT NULL,
      facial_area_w INTEGER NOT NULL,
      facial_area_h INTEGER NOT NULL,
      face_confidence REAL NOT NULL,
      embedding F32_BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_face_records_actor ON face_records(actor_id);
    CREATE INDEX IF NOT EXISTS idx_face_records_video ON face_records(video_id);
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

// --- Types ---

export interface FaceRecord {
  id: number
  actor_id: number
  video_id: number
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
  actor_id: number
  video_id: number
  image_blob: Buffer
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: Buffer
}

export interface ActorMatchCandidate {
  actor_id: number
  distance: number
  similarity: number
  image_blob: Buffer
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
}

// --- Actors ---

export function createActor(name?: string): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare('INSERT INTO actors (name) VALUES (?)')
  const result = stmt.run(name || null)
  return Number(result.lastInsertRowid)
}

// --- Videos ---

export function findOrCreateVideo(videoPath: string): number {
  if (!db) throw new Error('Database not initialized')
  const existing = db.prepare('SELECT id FROM videos WHERE path = ?').get(videoPath) as { id: number } | undefined
  if (existing) return existing.id
  const stmt = db.prepare('INSERT INTO videos (path) VALUES (?)')
  const result = stmt.run(videoPath)
  return Number(result.lastInsertRowid)
}

// --- Face Records ---

export function insertFaceRecord(params: FaceInsertParams): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO face_records (actor_id, video_id, image_blob, facial_area_x, facial_area_y, facial_area_w, facial_area_h, face_confidence, embedding)
    VALUES (@actor_id, @video_id, @image_blob, @facial_area_x, @facial_area_y, @facial_area_w, @facial_area_h, @face_confidence, @embedding)
  `)
  const result = stmt.run({
    actor_id: params.actor_id,
    video_id: params.video_id,
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

export function hasFaceRecord(actorId: number, videoId: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const row = db.prepare('SELECT 1 FROM face_records WHERE actor_id = ? AND video_id = ? LIMIT 1').get(actorId, videoId)
  return !!row
}

export function searchMatchingActors(embedding: Buffer, maxDistance: number = 0.5): ActorMatchCandidate[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    SELECT
      fr.actor_id,
      fr.image_blob,
      fr.facial_area_x,
      fr.facial_area_y,
      fr.facial_area_w,
      fr.facial_area_h,
      vec_distance_cosine(fr.embedding, ?) AS distance
    FROM face_records fr
    WHERE vec_distance_cosine(fr.embedding, ?) <= ?
    ORDER BY distance ASC
    LIMIT 50
  `).all(embedding, embedding, maxDistance) as any[]

  const actorMap = new Map<number, ActorMatchCandidate>()
  for (const row of rows) {
    if (!actorMap.has(row.actor_id)) {
      actorMap.set(row.actor_id, {
        actor_id: row.actor_id,
        distance: row.distance,
        similarity: Math.round((1 - row.distance) * 10000) / 100,
        image_blob: row.image_blob,
        facial_area_x: row.facial_area_x,
        facial_area_y: row.facial_area_y,
        facial_area_w: row.facial_area_w,
        facial_area_h: row.facial_area_h
      })
    }
  }
  return Array.from(actorMap.values()).sort((a, b) => a.distance - b.distance).slice(0, 5)
}

export function searchSimilarFaces(embedding: Buffer, maxDistance: number = 0.5): any[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    SELECT
      fr.id, fr.actor_id, fr.video_id, v.path AS video_path,
      fr.image_blob, fr.facial_area_x, fr.facial_area_y,
      fr.facial_area_w, fr.facial_area_h, fr.face_confidence,
      fr.created_at,
      vec_distance_cosine(fr.embedding, ?) AS distance
    FROM face_records fr
    JOIN videos v ON v.id = fr.video_id
    WHERE vec_distance_cosine(fr.embedding, ?) <= ?
    ORDER BY distance ASC
    LIMIT 50
  `).all(embedding, embedding, maxDistance)

  return rows
}

export function getAllFaceRecords(): FaceRecord[] {
  if (!db) throw new Error('Database not initialized')
  return db.prepare(`
    SELECT fr.*, v.path AS video_path
    FROM face_records fr
    JOIN videos v ON v.id = fr.video_id
    ORDER BY fr.created_at DESC
  `).all() as FaceRecord[]
}

export function deleteFaceRecord(id: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM face_records WHERE id = ?').run(id)
  return result.changes > 0
}

export function getActorById(actorId: number): { id: number; name: string | null; created_at: string } | undefined {
  if (!db) throw new Error('Database not initialized')
  return db.prepare('SELECT * FROM actors WHERE id = ?').get(actorId) as any
}

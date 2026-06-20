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
      image_blob BLOB,
      facial_area_x INTEGER,
      facial_area_y INTEGER,
      facial_area_w INTEGER,
      facial_area_h INTEGER,
      face_confidence REAL,
      embedding F32_BLOB,
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
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE
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
}

export interface CreateActorParams {
  name?: string
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

export interface ActorWithRecords {
  actor_id: number
  name: string | null
  image_blob: Buffer | null
  facial_area_x: number | null
  facial_area_y: number | null
  facial_area_w: number | null
  facial_area_h: number | null
  face_confidence: number | null
  created_at: string
  records: {
    id: number
    video_id: number
    video_path: string
    created_at: string
  }[]
}

// --- Actors ---

export function createActor(params: CreateActorParams): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO actors (name, image_blob, facial_area_x, facial_area_y, facial_area_w, facial_area_h, face_confidence, embedding)
    VALUES (@name, @image_blob, @facial_area_x, @facial_area_y, @facial_area_w, @facial_area_h, @face_confidence, @embedding)
  `)
  const result = stmt.run({
    name: params.name || null,
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

export function getActorById(actorId: number): {
  id: number
  name: string | null
  image_blob: Buffer | null
  facial_area_x: number | null
  facial_area_y: number | null
  facial_area_w: number | null
  facial_area_h: number | null
  face_confidence: number | null
  embedding: Buffer | null
  created_at: string
} | undefined {
  if (!db) throw new Error('Database not initialized')
  return db.prepare('SELECT * FROM actors WHERE id = ?').get(actorId) as any
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

export function insertFaceRecord(actorId: number, videoId: number): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare('INSERT INTO face_records (actor_id, video_id) VALUES (?, ?)')
  const result = stmt.run(actorId, videoId)
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
      a.id AS actor_id,
      a.image_blob,
      a.facial_area_x,
      a.facial_area_y,
      a.facial_area_w,
      a.facial_area_h,
      vec_distance_cosine(a.embedding, ?) AS distance
    FROM actors a
    WHERE a.embedding IS NOT NULL
      AND vec_distance_cosine(a.embedding, ?) <= ?
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
      a.image_blob, a.facial_area_x, a.facial_area_y,
      a.facial_area_w, a.facial_area_h, a.face_confidence,
      a.created_at AS actor_created_at,
      v.created_at AS video_created_at,
      vec_distance_cosine(a.embedding, ?) AS distance
    FROM actors a
    JOIN face_records fr ON fr.actor_id = a.id
    JOIN videos v ON v.id = fr.video_id
    WHERE a.embedding IS NOT NULL
      AND vec_distance_cosine(a.embedding, ?) <= ?
    ORDER BY distance ASC
    LIMIT 50
  `).all(embedding, embedding, maxDistance)

  return rows
}

export function getAllFaceRecords(): FaceRecord[] {
  if (!db) throw new Error('Database not initialized')
  return db.prepare(`
    SELECT fr.id, fr.actor_id, fr.video_id, v.path AS video_path
    FROM face_records fr
    JOIN videos v ON v.id = fr.video_id
    ORDER BY fr.id DESC
  `).all() as FaceRecord[]
}

export function getAllActorsWithRecords(): any[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    SELECT
      a.id AS actor_id,
      a.name,
      a.image_blob,
      a.facial_area_x,
      a.facial_area_y,
      a.facial_area_w,
      a.facial_area_h,
      a.face_confidence,
      a.created_at AS actor_created_at,
      fr.id AS record_id,
      fr.video_id,
      v.path AS video_path,
      v.created_at AS record_created_at
    FROM actors a
    LEFT JOIN face_records fr ON fr.actor_id = a.id
    LEFT JOIN videos v ON v.id = fr.video_id
    ORDER BY a.id
  `).all() as any[]

  const actorMap = new Map<number, any>()
  for (const row of rows) {
    if (!actorMap.has(row.actor_id)) {
      actorMap.set(row.actor_id, {
        actor_id: row.actor_id,
        name: row.name,
        image_blob: row.image_blob,
        facial_area_x: row.facial_area_x,
        facial_area_y: row.facial_area_y,
        facial_area_w: row.facial_area_w,
        facial_area_h: row.facial_area_h,
        face_confidence: row.face_confidence,
        created_at: row.actor_created_at,
        records: []
      })
    }
    if (row.record_id !== null) {
      actorMap.get(row.actor_id).records.push({
        id: row.record_id,
        video_id: row.video_id,
        video_path: row.video_path,
        created_at: row.record_created_at
      })
    }
  }
  return Array.from(actorMap.values())
}

export function deleteFaceRecord(id: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM face_records WHERE id = ?').run(id)
  return result.changes > 0
}

export function deleteVideo(videoId: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM videos WHERE id = ?').run(videoId)
  return result.changes > 0
}

export function deleteOrphanActors(): number {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare(`
    DELETE FROM actors WHERE id NOT IN (SELECT DISTINCT actor_id FROM face_records)
  `).run()
  return result.changes
}

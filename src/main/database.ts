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
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS actor_faces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      image_blob BLOB,
      facial_area_x INTEGER,
      facial_area_y INTEGER,
      facial_area_w INTEGER,
      facial_area_h INTEGER,
      face_confidence REAL,
      embedding F32_BLOB
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path VARCHAR(255) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS face_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_actor_faces_actor ON actor_faces(actor_id);
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

export interface AddActorFaceParams {
  image_blob: Buffer
  facial_area_x: number
  facial_area_y: number
  facial_area_w: number
  facial_area_h: number
  face_confidence: number
  embedding: Buffer
}

export interface ActorFaceRow {
  id: number
  actor_id: number
  image_blob: Buffer | null
  facial_area_x: number | null
  facial_area_y: number | null
  facial_area_w: number | null
  facial_area_h: number | null
  face_confidence: number | null
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

export function renameActor(actorId: number, name: string): boolean {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare('UPDATE actors SET name = ? WHERE id = ?')
  const result = stmt.run(name, actorId)
  return result.changes > 0
}

export function addActorFace(actorId: number, params: AddActorFaceParams): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO actor_faces (actor_id, image_blob, facial_area_x, facial_area_y, facial_area_w, facial_area_h, face_confidence, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    actorId,
    params.image_blob,
    params.facial_area_x,
    params.facial_area_y,
    params.facial_area_w,
    params.facial_area_h,
    params.face_confidence,
    params.embedding
  )
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
    SELECT * FROM (
      SELECT
        af.actor_id,
        af.image_blob,
        af.facial_area_x,
        af.facial_area_y,
        af.facial_area_w,
        af.facial_area_h,
        vec_distance_cosine(af.embedding, ?) AS distance,
        ROW_NUMBER() OVER (PARTITION BY af.actor_id ORDER BY vec_distance_cosine(af.embedding, ?) ASC) AS rn
      FROM actor_faces af
      WHERE af.embedding IS NOT NULL
        AND vec_distance_cosine(af.embedding, ?) <= ?
    ) ranked
    WHERE rn = 1
    ORDER BY distance ASC
    LIMIT 5
  `).all(embedding, embedding, embedding, maxDistance) as any[]

  return rows.map((row: any) => ({
    actor_id: row.actor_id,
    distance: row.distance,
    similarity: Math.round((1 - row.distance) * 10000) / 100,
    image_blob: row.image_blob,
    facial_area_x: row.facial_area_x,
    facial_area_y: row.facial_area_y,
    facial_area_w: row.facial_area_w,
    facial_area_h: row.facial_area_h
  }))
}

export function searchSimilarFaces(embedding: Buffer, maxDistance: number = 0.5): any[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    WITH best_faces AS (
      SELECT
        af.actor_id,
        af.image_blob,
        af.facial_area_x,
        af.facial_area_y,
        af.facial_area_w,
        af.facial_area_h,
        af.face_confidence,
        vec_distance_cosine(af.embedding, ?) AS distance,
        ROW_NUMBER() OVER (PARTITION BY af.actor_id ORDER BY vec_distance_cosine(af.embedding, ?) ASC) AS rn
      FROM actor_faces af
      WHERE af.embedding IS NOT NULL
        AND vec_distance_cosine(af.embedding, ?) <= ?
    )
    SELECT
      fr.id, fr.actor_id, fr.video_id, v.path AS video_path,
      bf.image_blob, bf.facial_area_x, bf.facial_area_y,
      bf.facial_area_w, bf.facial_area_h, bf.face_confidence,
      bf.distance
    FROM best_faces bf
    JOIN face_records fr ON fr.actor_id = bf.actor_id
    JOIN videos v ON v.id = fr.video_id
    WHERE bf.rn = 1
    ORDER BY bf.distance ASC, fr.id DESC
    LIMIT 200
  `).all(embedding, embedding, embedding, maxDistance)

  return rows
}

export function getAllActorsWithRecords(): any[] {
  if (!db) throw new Error('Database not initialized')
  const rows = db.prepare(`
    WITH best_confidence AS (
      SELECT
        af.actor_id,
        af.image_blob,
        af.facial_area_x,
        af.facial_area_y,
        af.facial_area_w,
        af.facial_area_h,
        af.face_confidence,
        ROW_NUMBER() OVER (PARTITION BY af.actor_id ORDER BY af.face_confidence DESC) AS rn
      FROM actor_faces af
    )
    SELECT
      a.id AS actor_id,
      a.name,
      bc.image_blob,
      bc.facial_area_x,
      bc.facial_area_y,
      bc.facial_area_w,
      bc.facial_area_h,
      bc.face_confidence,
      fr.id AS record_id,
      fr.video_id,
      v.path AS video_path
    FROM actors a
    LEFT JOIN best_confidence bc ON bc.actor_id = a.id AND bc.rn = 1
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
        records: []
      })
    }
    if (row.record_id !== null) {
      actorMap.get(row.actor_id).records.push({
        id: row.record_id,
        video_id: row.video_id,
        video_path: row.video_path
      })
    }
  }
  return Array.from(actorMap.values())
}

export function getActorFaces(actorId: number): ActorFaceRow[] {
  if (!db) throw new Error('Database not initialized')
  return db.prepare(`
    SELECT id, actor_id, image_blob, facial_area_x, facial_area_y, facial_area_w, facial_area_h, face_confidence
    FROM actor_faces
    WHERE actor_id = ?
    ORDER BY face_confidence DESC
  `).all(actorId) as ActorFaceRow[]
}

export function deleteActorFace(faceId: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM actor_faces WHERE id = ?').run(faceId)
  return result.changes > 0
}

export function deleteVideo(videoId: number): boolean {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare('DELETE FROM videos WHERE id = ?').run(videoId)
  return result.changes > 0
}

export function mergeActors(sourceActorId: number, targetActorId: number): void {
  if (!db) throw new Error('Database not initialized')
  if (sourceActorId === targetActorId) return

  const d = db
  const txn = d.transaction(() => {
    // Reassign face_records from source to target, skipping duplicates
    const existingRecords = d.prepare('SELECT video_id FROM face_records WHERE actor_id = ?').all(targetActorId) as { video_id: number }[]
    const existingVideoIds = new Set(existingRecords.map(r => r.video_id))

    const sourceRecords = d.prepare('SELECT id, video_id FROM face_records WHERE actor_id = ?').all(sourceActorId) as { id: number; video_id: number }[]
    for (const record of sourceRecords) {
      if (!existingVideoIds.has(record.video_id)) {
        d.prepare('UPDATE face_records SET actor_id = ? WHERE id = ?').run(targetActorId, record.id)
      }
    }

    // Reassign actor_faces from source to target
    d.prepare('UPDATE actor_faces SET actor_id = ? WHERE actor_id = ?').run(targetActorId, sourceActorId)

    // Delete source actor (cascades remaining face_records and actor_faces)
    d.prepare('DELETE FROM actors WHERE id = ?').run(sourceActorId)
  })

  txn()
}

export function deleteOrphanActors(): number {
  if (!db) throw new Error('Database not initialized')
  const result = db.prepare(`
    DELETE FROM actors WHERE id NOT IN (SELECT DISTINCT actor_id FROM face_records)
  `).run()
  return result.changes
}

import fetch from 'node-fetch'
import FormData from 'form-data'

const API_BASE = 'http://192.168.88.88:8066'
const API_KEY = 'mt_photos_ai_extra'

export interface CheckResult {
  result: string
  title: string
  help: string
  detector_backend: string
  recognition_model: string
  facial_min_score: number
  facial_max_distance: number
}

export interface FaceDetectResult {
  embedding: number[]
  facial_area: { x: number; y: number; w: number; h: number }
  face_confidence: number
}

export interface RepresentResult {
  detector_backend: string
  recognition_model: string
  result: FaceDetectResult[]
}

export async function checkApi(): Promise<CheckResult> {
  const response = await fetch(`${API_BASE}/check`, {
    method: 'POST',
    headers: { 'api-key': API_KEY }
  })
  if (!response.ok) {
    throw new Error(`API check failed: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<CheckResult>
}

export async function representImage(imageBuffer: Buffer): Promise<RepresentResult> {
  const form = new FormData()
  form.append('file', imageBuffer, {
    filename: 'image.jpg',
    contentType: 'image/jpeg'
  })

  const response = await fetch(`${API_BASE}/represent`, {
    method: 'POST',
    headers: { 'api-key': API_KEY },
    body: form
  })

  if (!response.ok) {
    throw new Error(`API represent failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<RepresentResult>
}

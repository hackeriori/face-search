# Face Search Desktop

A Windows desktop application for face recognition and similarity search, built with Electron + Vue 3 + TypeScript.

## Features

- **Face Enrollment** — Import video files or images, detect faces via InsightFace API, and store face embeddings in a local SQLite database with vector search support.
- **Face Search** — Input an image, retrieve the top-N most similar faces from the database, sorted by cosine similarity, with original screenshots and video info displayed.

## Tech Stack

| Category | Choice |
|---|---|
| Desktop Framework | Electron |
| Frontend | Vue 3 + TypeScript |
| Build Tools | Vite + electron-builder |
| CSS | TailwindCSS v4 |
| Database | better-sqlite3 + sqlite-vec (vector search) |
| Face Recognition | Remote InsightFace API (`/represent`, `/check`) |
| Video Processing | HTML5 `<video>` + Canvas; ffmpeg.wasm for fallback |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
face-search/
├── vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── src/
│   ├── main/             # Electron main process
│   │   ├── index.ts      # Entry point
│   │   ├── database.ts   # SQLite + sqlite-vec operations
│   │   ├── faceApi.ts    # InsightFace API client
│   │   └── ipc.ts        # IPC handlers
│   ├── preload/           # Preload script (bridge API)
│   │   └── index.ts
│   └── renderer/          # Vue 3 renderer
│       ├── index.html
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── style.css
│       │   ├── components/
│       │   │   ├── VideoPlayer.vue
│       │   │   ├── ImageInput.vue
│       │   │   ├── FaceSelector.vue
│       │   │   └── SearchResults.vue
│       │   ├── pages/
│       │   │   ├── RecordPage.vue
│       │   │   └── SearchPage.vue
│       │   └── lib/
│       │       ├── api.ts
│       │       └── types.ts
│       └── assets/
└── resources/             # Electron packaged resources (ffmpeg.wasm, etc.)
```

## Face Recognition API

The app communicates with a remote InsightFace instance at `http://192.168.88.88:8066` (configurable). See `implementation_plan.md` for API details.

## License

See [LICENSE](LICENSE).

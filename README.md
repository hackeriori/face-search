# Face Search Desktop

基于 Electron + Vue 3 + TypeScript 构建的 Windows 桌面端人脸识别与相似度搜索应用。

## 功能

- **人脸录入** — 导入视频文件，通过 ffmpeg 推送本地 HTTP-FLV 流并由前端 flv.js 播放，捕获目标帧后调用 InsightFace API 检测人脸，自动匹配已有演员（Actor）或创建新条目，将人脸特征向量与截图存入本地 SQLite 数据库。
- **人脸搜索** — 上传图片或从剪贴板粘贴，提取人脸特征向量，按余弦相似度检索数据库中 Top-5 最相似的人脸，展示匹配演员、相似度分数及来源视频路径。
- **人脸管理** — 浏览所有已录入的演员及其关联视频记录，支持展开/折叠、删除单条记录，并提供「清理孤儿数据」功能一键移除指向已不存在视频文件的记录。

## 技术栈

| 类别 | 选型 |
|---|---|
| 桌面框架 | Electron |
| 前端 | Vue 3 + TypeScript（Composition API + `<script setup>`） |
| 构建工具 | Vite + vite-plugin-electron + electron-builder |
| 样式 | TailwindCSS v4 |
| 数据库 | better-sqlite3 + sqlite-vec（向量搜索扩展） |
| 人脸识别 | 远程 InsightFace API（`/represent`、`/check`） |
| 视频播放 | ffmpeg / ffprobe（主进程推送 HTTP-FLV）+ flv.js（前端播放） |

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9
- ffmpeg 与 ffprobe 可执行文件在 `PATH` 中可用，或放置到 `resources/ffmpeg/` 目录。

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

### 构建安装包

```bash
npm run build
npm run build:electron
```

## 架构概要

```
Renderer (Vue 3)  ←→  Preload (contextBridge)  ←→  Main Process (Electron)
                                                       ├── database.ts    — SQLite + sqlite-vec CRUD 与向量搜索
                                                       ├── faceApi.ts     — InsightFace REST 客户端
                                                       ├── ffmpegStream.ts — ffmpeg HTTP-FLV 推流与截图
                                                       └── ipc.ts         — 统一 IPC 处理器注册
```

## 人脸识别 API

应用需连接远程 InsightFace 服务（默认 `http://192.168.88.88:8066`），API 密钥为 `mt_photos_ai_extra`。通过 `/check` 检测服务健康状态，通过 `/represent` 上传图片获取人脸检测框及 512 维特征向量。

## 许可证

[Apache License 2.0](LICENSE)

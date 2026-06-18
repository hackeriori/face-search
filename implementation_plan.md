# 人脸搜索桌面应用 - 实现计划

## 背景

构建一个 Windows 桌面应用，基于 Node.js，实现两个核心功能：
1. **人脸识别与存储**：从视频帧或图片中检测人脸，选择后存入数据库
2. **人脸对比搜索**：输入一张包含单个人脸的图片，在数据库中查找相似人脸

---

## 技术栈确认

| 分类 | 选择 | 说明 |
|---|---|---|
| **桌面框架** | Electron | 成熟的 Node.js 桌面应用框架，支持 Windows 原生功能（剪贴板读取等） |
| **前端框架** | Vue 3 + TypeScript | 组合式 API，类型安全 |
| **构建工具** | Vite + Electron + electron-builder | Vite 作为开发服务器，Electron 承载桌面应用 |
| **CSS 框架** | TailwindCSS v4 | 用户指定的技术栈 |
| **数据库** | better-sqlite3 + sqlite-vec 扩展 | SQLite + 原生向量检索扩展 |
| **视频处理** | HTML5 `<video>` + Canvas + ffmpeg.wasm (静态资源打包) | 主流格式用 `<video>` 截帧，wmv/mkv/avi 等通过 ffmpeg.wasm 解码播放 (.wasm 内置在 resources/ 中) |
| **HTTP 客户端** | node-fetch / Electron net | 调用人脸识别 API |
| **人脸识别** | 远程 API (InsightFace) | 已部署 `http://192.168.88.88:8066` |
| **向量相似度** | SQLite 向量扩展 (sqlite-vec) | 原生 `F32_BLOB` 存储 + `vec_distance_cosine()` 检索 |

---

## 人脸识别 API 接口文档

### API 基地址
`http://192.168.88.88:8066`

### 认证方式
HTTP Header: `api-key: mt_photos_ai_extra`

### 接口一：POST `/check`
**用途**：检查服务状态、获取推荐参数

**请求**：
```http
POST /check
Headers: api-key: mt_photos_ai_extra
```

**响应示例**：
```json
{
  "result": "pass",
  "title": "mt-photos-insightface",
  "help": "https://mtmt.tech/docs/advanced/insightface_api",
  "detector_backend": "insightface",
  "recognition_model": "buffalo_l",
  "facial_min_score": 0.65,
  "facial_max_distance": 0.5
}
```

关键参数说明：
- `facial_min_score`: **0.65** — 推荐的人脸检测最低置信度阈值
- `facial_max_distance`: **0.5** — 推荐的人脸差异值（余弦距离），低于此值认为是同一人

---

### 接口二：POST `/represent`
**用途**：上传图片，检测人脸并返回特征向量

**请求**：
```http
POST /represent
Headers: api-key: mt_photos_ai_extra
Content-Type: multipart/form-data
Body: file=<image_binary>
```

**响应示例**（使用 test.webp 测试，检测到 3 张人脸）：
```json
{
  "detector_backend": "insightface",
  "recognition_model": "buffalo_l",
  "result": [
    {
      "embedding": [-0.0528, -0.0162, ...],   // 512维浮点数数组
      "facial_area": { "x": 248, "y": 96, "w": 39, "h": 50 },
      "face_confidence": 0.9066528081893921
    },
    {
      "embedding": [-0.0951, -0.0119, ...],
      "facial_area": { "x": 156, "y": 32, "w": 68, "h": 86 },
      "face_confidence": 0.8692263960838318
    },
    {
      "embedding": [0.0164, -0.0347, ...],
      "facial_area": { "x": 317, "y": 35, "w": 64, "h": 73 },
      "face_confidence": 0.7571971416473389
    }
  ]
}
```

返回字段说明：
| 字段 | 类型 | 说明 |
|---|---|---|
| `embedding` | `number[]` | 512 维归一化人脸特征向量 |
| `facial_area.x` | `number` | 人脸框左上角 X 坐标 |
| `facial_area.y` | `number` | 人脸框左上角 Y 坐标 |
| `facial_area.w` | `number` | 人脸框宽度 |
| `facial_area.h` | `number` | 人脸框高度 |
| `face_confidence` | `number` | 人脸检测置信度 (0~1) |

> [!NOTE]
> - 图片宽高不能超过 10000 像素
> - 支持常见图片格式（包括 webp、gif 等）
> - 向量长度固定为 512 维
> - API 在 5 分钟无请求后会自动释放模型，下次请求时重新加载（首次请求可能较慢）

---

### 接口三：POST `/restart`
**用途**：触发服务重启释放内存

---

## 数据库设计

### SQLite 表结构

```sql
-- 人脸记录表
CREATE TABLE IF NOT EXISTS face_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_path VARCHAR(255) NOT NULL,         -- 关联视频的绝对路径（255字符以内）
  image_blob BLOB NOT NULL,                 -- 截图/图片的二进制数据 (JPEG/PNG)
  facial_area_x INTEGER NOT NULL,           -- 人脸框 X
  facial_area_y INTEGER NOT NULL,           -- 人脸框 Y
  facial_area_w INTEGER NOT NULL,           -- 人脸框宽度
  facial_area_h INTEGER NOT NULL,           -- 人脸框高度
  face_confidence REAL NOT NULL,            -- 人脸置信度
  embedding F32_BLOB NOT NULL,              -- 512维特征向量 (sqlite-vec 原生向量类型)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  note TEXT                                 -- 可选备注
);

-- 为 video_path 创建索引以加速按视频查询
CREATE INDEX IF NOT EXISTS idx_video_path ON face_records(video_path);

-- 加载 sqlite-vec 扩展并创建向量索引
-- .load ./vec0
-- CREATE VIRTUAL TABLE IF NOT EXISTS face_vec USING vec0(
--   embedding float[512] distance_metric=cosine
-- );
```

> [!NOTE]
> **向量存储策略**：使用 `sqlite-vec` 扩展将 512 维浮点向量存储为原生 `F32_BLOB` 类型，并构建 IVF 索引加速检索。查询时调用 `vec_distance_cosine()` 函数直接计算余弦距离，排序后返回 Top-N 结果。

---

## 应用架构

```
┌──────────────────────────────────────────────────┐
│                  Electron Main Process            │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ better-sqlite3│  │  IPC Handlers │              │
│  │ + sqlite-vec  │  │              │              │
│  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  Face API     │  │  File System │              │
│  │  Client       │  │  Access      │              │
│  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────┘
                        ↕ IPC
┌──────────────────────────────────────────────────┐
│              Electron Renderer Process            │
│  ┌──────────────────────────────────────────┐    │
│  │           Vue 3 + TailwindCSS             │    │
│  │  ┌──────────────────────────────────┐    │    │
│  │  │    [录入]  [搜索]  ← 顶部 Tab   │    │    │
│  │  └──────────────────────────────────┘    │    │
│  │  ┌───────────────┐ ┌────────────────┐   │    │
│  │  │  录入页面      │ │  搜索页面       │   │    │
│  │  │  (视频/图片    │ │  (图片输入 +    │   │    │
│  │  │    + 人脸选择) │ │   相似度结果)   │   │    │
│  │  └───────────────┘ └────────────────┘   │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

## 功能模块详细设计

### 模块一：人脸录入

#### 用户流程：
1. 用户拖拽/选择一个**视频文件**
2. 用户选择图片来源：
   - **视频帧截取**：使用视频播放器滑动到目标时间点，点击"截取当前帧"
   - **外部图片**：从文件选择或从**剪贴板粘贴**
3. 图片发送到 InsightFace API `/represent` 接口
4. 返回结果后，在图片上用**方框标记**所有检测到的人脸
5. 用户**点击选择**目标人脸（方框高亮）
6. 点击"保存"，将以下信息存入 SQLite：
   - 视频文件路径
   - 图片二进制数据
   - 选中人脸的坐标框
   - 选中人脸的 512 维特征向量
   - 置信度

#### 关键技术点：
- **视频帧截取**：主流格式（mp4/webm/ogg）使用 `<video>` + `<canvas>.drawImage()` + `canvas.toBlob()`；wmv/mkv/avi 等格式使用 ffmpeg.wasm 解码后送入 Canvas
- **剪贴板读取**：Electron 的 `clipboard.readImage()` API
- **人脸框绘制**：在 Canvas 上绘制矩形框，支持点击选择

### 模块二：人脸搜索

#### 用户流程：
1. 用户输入一张图片（文件选择或**剪贴板粘贴**）
2. 调用 `/represent` 接口获取人脸特征向量
3. 使用 sqlite-vec 的 `vec_distance_cosine()` 检索相似记录
4. 将匹配结果按余弦相似度**从高到低排列**，全部展示在列表中：
   - 原始截图（带人脸框标记）
   - 关联的视频路径（可点击打开）
   - **相似度分数**（百分比显示）
   - 录入时间
5. 当有多条记录匹配时，按相似度降序排列，相似度最高的排在最前面

#### 相似度计算（由 sqlite-vec 完成）：
```typescript
// 查询语句示例
const rows = db.prepare(`
  SELECT
    id, video_path, image_blob, facial_area_x, facial_area_y,
    facial_area_w, facial_area_h, face_confidence, created_at, note,
    vec_distance_cosine(embedding, ?) AS distance
  FROM face_records
  WHERE vec_distance_cosine(embedding, ?) <= 0.5
  ORDER BY distance ASC
`).all(queryEmbedding, queryEmbedding);

// distance 转 similarity
// similarity = (1 - distance) * 100%
```

匹配阈值：当余弦距离 ≤ 0.5（即 `facial_max_distance`）时，视为匹配。距离越小相似度越高。

---

## 项目目录结构

```
face-search/
├── vite.config.ts                    # Vite 配置（主进程 + 渲染进程）
├── electron-builder.yml              # 打包配置
├── package.json
├── tsconfig.json
├── tailwind.config.ts                # TailwindCSS v4（仅 CSS 变量覆盖）
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 主进程入口
│   │   ├── database.ts              # SQLite 数据库操作封装（含 sqlite-vec）
│   │   ├── faceApi.ts               # InsightFace API 客户端
│   │   └── ipc.ts                   # IPC 事件处理
│   ├── preload/                      # 预加载脚本
│   │   └── index.ts                 # 暴露安全 API 给渲染进程
│   └── renderer/                     # 渲染进程 (Vue 3)
│       ├── index.html
│       ├── src/
│       │   ├── main.ts              # Vue 入口
│       │   ├── App.vue              # 主应用组件（顶部 Tabs 导航）
│       │   ├── style.css            # TailwindCSS v4 入口
│       │   ├── components/
│       │   │   ├── VideoPlayer.vue  # 视频播放 + 帧截取
│       │   │   ├── ImageInput.vue   # 图片输入（文件/剪贴板）
│       │   │   ├── FaceSelector.vue # 人脸框展示 + 选择
│       │   │   └── SearchResults.vue# 搜索结果展示（相似度排序）
│       │   ├── pages/
│       │   │   ├── RecordPage.vue   # 录入页面
│       │   │   └── SearchPage.vue   # 搜索页面
│       │   └── lib/
│       │       ├── api.ts          # 通过 preload 调用主进程 API
│       │       └── types.ts        # TypeScript 类型定义
│       └── assets/                  # 静态资源
└── resources/                       # Electron 打包资源
```

---

## 核心依赖包

| 包名 | 版本 | 用途 |
|---|---|---|
| `electron` | ^35 | 桌面应用框架 |
| `vite` | ^6 | 构建工具 |
| `vue` | ^3 | UI 框架 |
| `vue-router` | ^4 | 前端路由 |
| `better-sqlite3` | ^11 | SQLite3 数据库 |
| `sqlite-vec` | ^0.1 | SQLite 向量扩展（原生 F32_BLOB + 余弦距离检索） |
| `tailwindcss` | ^4 | CSS 框架 |
| `@tailwindcss/vite` | ^4 | TailwindCSS Vite 插件 |
| `ffmpeg.wasm` | ^0.12 | 浏览器端 FFmpeg 解码（wmv/mkv/avi 等格式） |
| `form-data` | ^4 | 构建 multipart/form-data 请求 |
| `electron-builder` | ^25 | 应用打包 |

---

## 实施步骤

### Phase 1: 项目初始化
1. 使用 `npm create vite@latest` 创建 Vue 3 + TypeScript 模板
2. 集成 Electron（main + preload 进程），配置 Vite 多入口构建
3. 安装 TailwindCSS v4 + `@tailwindcss/vite` 插件
4. 安装 `better-sqlite3` + `sqlite-vec` 并进行 Electron rebuild
5. 安装 `ffmpeg.wasm` 用于多格式视频解码
6. 验证基本的 Electron 应用可启动

### Phase 2: 数据库层
7. 实现 `database.ts` — SQLite 初始化、加载 sqlite-vec 扩展、表创建、CRUD
8. 实现基于 sqlite-vec 的向量插入和余弦距离检索

### Phase 3: API 客户端
9. 实现 `faceApi.ts` — 封装 `/check` 和 `/represent` 接口调用
10. 实现 `ipc.ts` — 注册 IPC 事件处理器

### Phase 4: 预加载脚本
11. 实现 `preload/index.ts` — 安全暴露主进程能力给渲染进程

### Phase 5: 前端 UI - 录入功能
12. 实现视频播放器组件（主流格式 `<video>` + Canvas 截帧，其他格式 ffmpeg.wasm）
13. 实现图片输入组件（文件选择 + 剪贴板粘贴）
14. 实现人脸框展示和选择组件
15. 实现录入页面完整流程

### Phase 6: 前端 UI - 搜索功能
16. 实现搜索页面（图片输入 + 多结果展示）
17. 实现搜索结果组件（按相似度降序排列，显示相似度百分比 + 视频信息）

### Phase 7: 整合与调试
18. 完整流程测试
19. UI 美化和交互优化
20. 错误处理和边界情况

---

## 补充说明

> [!IMPORTANT]
> 1. **API 密钥**：使用默认密钥 `mt_photos_ai_extra`，不会变更
> 2. **ffmpeg.wasm 静态资源**：ffmpeg.wasm 的核心 `.wasm` 文件（约 30MB）在开发阶段通过 `npm run postinstall` 脚本下载到 `resources/ffmpeg/` 目录下，随应用一起打包，运行时直接读取本地文件，无需联网下载

---

## Verification Plan

### Automated Tests
- 数据库 CRUD 操作单元测试
- 余弦距离检索测试（sqlite-vec）
- API 客户端集成测试

### Manual Verification
- 完整录入流程：选择视频 → 截帧/贴图 → 检测人脸 → 选择 → 保存
- 完整搜索流程：输入图片 → 检测 → 匹配（多结果排序） → 展示
- 剪贴板粘贴功能
- 多格式视频（mp4/wmv/mkv/avi）播放与帧截取
- Windows 下应用打包与运行

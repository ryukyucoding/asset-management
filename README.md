# 資產管理系統

TSMC 課程專案。支援資產借用、領用、審核流程，部署目標為 GCP Cloud Run。

## 系統架構文件

| 文件 | 說明 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | Overall System Architecture Diagram |
| [docs/sequence-diagram.md](docs/sequence-diagram.md) | Sequence Diagram（登入、維修申請流程、狀態機） |
| [docs/er-diagram.md](docs/er-diagram.md) | ER Diagram（資料庫實體關係） |

---

## 技術架構

| 層 | 技術 |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Pinia + Element Plus + vue-i18n |
| Backend | Node.js + Fastify + TypeScript (Clean Architecture) |
| Database | PostgreSQL (本地 Docker / 雲端 Cloud SQL) |
| Cache/Queue | Redis + BullMQ (本地 Docker / 雲端 Memorystore) |
| ORM | Prisma |
| 圖片存儲 | 本地 `./uploads/`（開發）/ GCS（生產） |

---

## 前置需求

- Node.js 22+
- pnpm 10+（`npm install -g pnpm`）
- Docker Desktop

---

## 安裝

### 1. Clone repo

```bash
git clone https://github.com/ryukyucoding/asset-management.git
cd asset-management
```

### 2. 安裝所有依賴

```bash
# root 執行，一次安裝 backend + frontend 所有依賴
pnpm install
```

### 3. 設定環境變數

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

`backend/.env` 預設值已可直接使用本地 Docker，無需修改。

---

## 本地資料庫（Docker）

> **Port 說明：** Docker PostgreSQL 使用 `5434`，避開本機常見的 5432（Homebrew）與 5433（EDB）。
> 若你的機器沒有 port 衝突，可在 `docker-compose.yml` 自行調整。

### 啟動 PostgreSQL + Redis

```bash
docker compose up -d
```

### 執行 DB migration + seed

```bash
cd backend
pnpm db:migrate     # 建立所有資料表（prisma migrate dev）
pnpm db:seed        # 填入初始帳號與範例資產
```

seed 完成後可用以下帳密登入：

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | `admin@example.com` | `Admin1234` |
| 一般用戶 | `user@example.com` | `User1234` |

### 確認資料已進入 Docker

```bash
docker exec asset-management-postgres-1 \
  psql -U postgres -d asset_management \
  -c 'SELECT email, role FROM users;'
```

正常輸出：

```
       email       | role
-------------------+-------
 admin@example.com | ADMIN
 user@example.com  | USER
```

### 重置資料庫（清空重來）

```bash
cd backend
pnpm db:reset       # prisma migrate reset --force（會重跑 seed）
```

或完全清除 Docker volume：

```bash
docker compose down -v      # 停止並刪除所有資料
docker volume rm asset-management_postgres_data   # 若 down -v 未清乾淨
docker compose up -d
cd backend && pnpm db:migrate && pnpm db:seed
```

### 停止資料庫

```bash
docker compose down          # 停止但保留資料
docker compose down -v       # 停止並清除所有資料
```

---

## Migration 工作流程

### 日常流程（修改 schema）

```bash
cd backend

# 1. 編輯 prisma/schema.prisma
# 2. 建立並套用 migration（開發環境）
pnpm db:migrate

# 3. 重新產生 Prisma Client 型別
pnpm db:generate
```

> `pnpm db:migrate` 會互動式詢問 migration 名稱，例如輸入 `add_asset_image_urls`。

### 生產部署流程

```bash
# 生產環境只套用 migration，不建立新的
pnpm db:migrate:prod    # prisma migrate deploy
```

### 手動建立 migration（特殊情況）

若遇到 migrate dev 失敗（如「applied but missing from local」），可改用手動方式：

```bash
# 1. 在 prisma/migrations/ 建立新目錄，名稱格式：NNNN_描述
mkdir -p backend/prisma/migrations/0003_your_change

# 2. 在目錄內建立 migration.sql，寫入 DDL
cat > backend/prisma/migrations/0003_your_change/migration.sql << 'EOF'
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "newField" TEXT;
EOF

# 3. 套用到資料庫
cd backend && pnpm db:migrate:prod

# 4. 重新產生 Prisma Client
pnpm db:generate
```

### Prisma 指令速查

| 指令 | 說明 |
|------|------|
| `pnpm db:migrate` | 建立 migration 並套用（開發用，會互動詢問名稱） |
| `pnpm db:migrate:prod` | 套用所有 pending migrations（生產用，不建立新的） |
| `pnpm db:generate` | 重新產生 Prisma Client（schema 改動後執行） |
| `pnpm db:seed` | 填入種子資料（admin + user + 範例資產） |
| `pnpm db:reset` | 清空 DB 並重跑所有 migration + seed（開發用） |

## 啟動開發伺服器

從 root 同時啟動

```bash
# 需先安裝 concurrently
pnpm add -D concurrently -w

# 同時啟動
pnpm dev
```

開啟瀏覽器：[http://localhost:5173](http://localhost:5173)
API：[http://localhost:3000](http://localhost:3000)
Health check：[http://localhost:3000/health](http://localhost:3000/health)

---

## 測試

### Backend

```bash
cd backend

pnpm test               # 跑所有 unit test
pnpm test:watch         # watch 模式
pnpm test:coverage      # 含覆蓋率報告（目標 80%+）
pnpm test:integration   # integration test（需要 DB 跑起來）
```

### Frontend

```bash
cd frontend

pnpm test:unit          # Vitest unit test
pnpm test:e2e           # Playwright E2E（需要前後端都起來）
```

---

## 專案結構

```
asset-management/
├── docker-compose.yml       # 本地 DB（PostgreSQL + Redis）
├── pnpm-workspace.yaml
│
├── backend/
│   ├── src/
│   │   ├── domain/          # 業務核心（entities + repository interfaces）
│   │   ├── infrastructure/  # Prisma 實作、storage adapters
│   │   │   └── storage/     # LocalStorageAdapter / GCSStorageAdapter
│   │   ├── services/        # 應用服務（auth, asset, application...）
│   │   ├── routes/          # Fastify routes
│   │   ├── dtos/            # Zod schema 驗證
│   │   ├── middleware/       # JWT auth, RBAC
│   │   └── index.ts         # 入口
│   ├── uploads/             # 本地上傳圖片（STORAGE_DRIVER=local 時）
│   └── prisma/
│       ├── schema.prisma
│       ├── seed.ts
│       └── migrations/
│           ├── 0001_init_repair_system/
│           └── 0002_asset_image_urls/
│
└── frontend/
    └── src/
        ├── apis/            # axios API 呼叫
        ├── components/      # 共用元件（含 ImageUploader.vue）
        ├── store/           # Pinia stores
        ├── composable/      # Vue composables
        ├── views/           # 頁面
        └── i18n/            # 中英文翻譯
```

---

## 預設帳號（seed 後）

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin@example.com | Admin1234 | 管理員 |
| user@example.com | User1234 | 一般用戶 |


---

## 部署（GCP Cloud Run）

### 前置需求

```bash
# 安裝 gcloud CLI 並登入
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 架構說明

| 角色 | 說明 |
|------|------|
| `docker-compose.yml` | **本地開發用** — 只啟動 PostgreSQL + Redis，應用程式跑在本機 |
| `backend/Dockerfile` | 打包 Backend（Node.js + Prisma）成 container image |
| `frontend/Dockerfile` | 打包 Frontend（Vue build → Nginx）成 container image |

Cloud Run 的 Zero Downtime 流程：
```
git push → CI build image → push 到 Artifact Registry
→ Cloud Run 啟動新 revision（舊的繼續服務）
→ /health 回 200 → 流量切到新 revision → 舊的 scale to 0
```

### 本地測試 Docker image（部署前驗證）

```bash
# 注意：兩個 image 都必須從 repo root 建（-f 指定 Dockerfile 路徑，. 為 root context）

# Backend
docker build -f backend/Dockerfile -t asset-backend .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e STORAGE_DRIVER="local" \
  asset-backend

# Frontend（VITE_API_URL 在 build 時燒進 JS bundle）
docker build \
  -f frontend/Dockerfile \
  --build-arg VITE_API_URL=http://localhost:3000 \
  -t asset-frontend .
docker run -p 8080:80 asset-frontend
```

### 部署到 Cloud Run

```bash
PROJECT_ID="your-gcp-project-id"
REGION="asia-east1"
BACKEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/asset-mgmt/backend"
FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/asset-mgmt/frontend"
BACKEND_URL="https://asset-backend-xxxx-de.a.run.app"   # 第一次部署後取得

# 1. 建立 Artifact Registry
gcloud artifacts repositories create asset-mgmt \
  --repository-format=docker --location=$REGION

# 2. Build & push backend（從 repo root 建）
docker build -f backend/Dockerfile -t $BACKEND_IMAGE .
docker push $BACKEND_IMAGE

# 3. Build & push frontend（從 repo root 建，帶入 backend URL）
docker build \
  -f frontend/Dockerfile \
  --build-arg VITE_API_URL=$BACKEND_URL \
  -t $FRONTEND_IMAGE .
docker push $FRONTEND_IMAGE

# 4. Deploy backend
gcloud run deploy asset-backend \
  --image=$BACKEND_IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars="DATABASE_URL=postgresql://...,JWT_SECRET=...,STORAGE_DRIVER=gcs,GCS_BUCKET_NAME=..."

# 5. Deploy frontend
gcloud run deploy asset-frontend \
  --image=$FRONTEND_IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1
```

> `--min-instances=1` 可避免冷啟動，確保 Zero Downtime。每次重新部署 Cloud Run 會先啟動新 revision 確認健康後再切流量。

### Zero Downtime 關鍵設定

| 設定 | 說明 |
|------|------|
| `GET /health` | Health check endpoint，DB 連線正常才回 200 |
| `--min-instances=1` | 至少保留一個 instance，避免 cold start 造成短暫無法服務 |
| `CMD prisma migrate deploy` | Container 啟動時自動套用 pending migrations（idempotent） |
| Cloud Run traffic splitting | 部署時舊 revision 繼續跑，新的通過 health check 才切流量 |

---

## 圖片上傳

### 本地開發（預設）

圖片存在後端本機的 `backend/uploads/` 目錄，透過 `GET /uploads/:filename` 提供存取。

```env
# backend/.env（預設，不需要額外設定）
STORAGE_DRIVER="local"
BASE_URL="http://localhost:3000"
```

上傳後的 URL 格式：`http://localhost:3000/uploads/<uuid>.jpg`

### 部署到 GCP Cloud Run（GCS）

切換只需修改環境變數，**程式碼零修改**。

```env
# backend/.env 或 Cloud Run 環境變數
STORAGE_DRIVER="gcs"
GCS_BUCKET_NAME="your-bucket-name"
# GOOGLE_APPLICATION_CREDENTIALS 不用設 — Cloud Run 自動使用 Attached Service Account
```

#### GCS Bucket 一次性設定

```bash
# 1. 建立 bucket（asia-east1 = 台灣）
gcloud storage buckets create gs://your-bucket-name --location=asia-east1

# 2. 讓圖片公開可讀
gcloud storage buckets add-iam-policy-binding gs://your-bucket-name \
  --member="allUsers" --role="roles/storage.objectViewer"

# 3. 給 Cloud Run Service Account 寫入權限
gcloud storage buckets add-iam-policy-binding gs://your-bucket-name \
  --member="serviceAccount:YOUR-SA@PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"
```

上傳後的 URL 格式：`https://storage.googleapis.com/your-bucket-name/uploads/<uuid>.jpg`

#### 本地想測試 GCS

```bash
# 下載 GCP service account key JSON，然後：
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
export STORAGE_DRIVER="gcs"
export GCS_BUCKET_NAME="your-bucket-name"
pnpm dev
```

### Storage Adapter 架構

```
src/infrastructure/storage/
├── storage.interface.ts       ← IStorageAdapter（save / delete）
├── local-storage.adapter.ts   ← 存 ./uploads/，開發用
├── gcs-storage.adapter.ts     ← 存 GCS bucket，生產用
└── storage.factory.ts         ← 讀 STORAGE_DRIVER 決定用哪個
```

---

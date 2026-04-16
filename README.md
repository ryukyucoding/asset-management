# 資產管理系統

TSMC 課程專案。支援資產借用、領用、審核流程，部署目標為 GCP Cloud Run。

## 技術架構

| 層 | 技術 |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Pinia + Element Plus + vue-i18n |
| Backend | Node.js + Fastify + TypeScript (Clean Architecture) |
| Database | PostgreSQL (本地 Docker / 雲端 Cloud SQL) |
| Cache/Queue | Redis + BullMQ (本地 Docker / 雲端 Memorystore) |
| ORM | Prisma |

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

### 啟動 PostgreSQL + Redis

```bash
docker compose up -d
```

### 執行 DB migration

```bash
cd backend
pnpm db:migrate     # 建立資料表
pnpm db:seed        # 填入初始資料（admin 帳號等）
```

### 停止資料庫

```bash
docker compose down          # 停止但保留資料
docker compose down -v       # 停止並清除所有資料
```

---

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

## Prisma 常用指令

```bash
cd backend

pnpm db:migrate         # 建立 migration 並套用
pnpm db:generate        # 重新產生 Prisma Client
pnpm db:seed            # 填入種子資料

# 修改 schema 後的流程：
# 1. 編輯 prisma/schema.prisma
# 2. pnpm db:migrate     ← 建立並套用 migration
# 3. pnpm db:generate    ← 更新 Prisma Client 型別
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
│   │   ├── infrastructure/  # Prisma 實作、外部服務 adapter
│   │   ├── services/        # 應用服務（auth, asset, application...）
│   │   ├── routes/          # Fastify routes
│   │   ├── dtos/            # Zod schema 驗證
│   │   ├── middleware/       # JWT auth, RBAC
│   │   └── index.ts         # 入口
│   └── prisma/
│       └── schema.prisma
│
└── frontend/
    └── src/
        ├── apis/            # axios API 呼叫
        ├── store/           # Pinia stores
        ├── composable/      # Vue composables
        ├── views/           # 頁面
        ├── components/      # 共用元件
        └── i18n/            # 中英文翻譯
```

---

## 預設帳號（seed 後）

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin@example.com | Admin1234 | 管理員 |
| user@example.com | User1234 | 一般用戶 |

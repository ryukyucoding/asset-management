# 雲原生架構面試問答整理

> 本文件依據本專案**實際程式碼與部署設定**整理，並標註「文件／架構圖」與「實作」不一致之處，方便口試時誠實回答與說明改進方向。  
> 相關檔案：[`scripts/gcp/deploy-backend-cloudrun.sh`](../scripts/gcp/deploy-backend-cloudrun.sh)、[`backend/src/infrastructure/database/prisma.client.ts`](../backend/src/infrastructure/database/prisma.client.ts)、[`backend/src/routes/auth.routes.ts`](../backend/src/routes/auth.routes.ts)

---

## 高機率、高難度

### Cloud Run 與擴展

#### Q1. `min-instances=1`、`max-instances=20` 是怎麼估算的？有做過壓力測試嗎？

**答：**

- **現況（誠實）**：repo 內**沒有** k6、Artillery、Locust 等壓力測試腳本或報告；數字來自 [`deploy-backend-cloudrun.sh`](../scripts/gcp/deploy-backend-cloudrun.sh) 的 **MVP 預設**，並在 [README](../README.md) 說明 `min-instances=1` 是為了**降低冷啟動**。
- **估算邏輯（設計意圖，非實測推導）**：
  - `min-instances=1`：課程／展示環境希望登入與第一筆 API 不要等冷啟動（約數秒）。
  - `max-instances=20`：Cloud Run 預設上限常見為 100；我們先設 20 作為**成本與併發上限的保守帽**，避免誤觸發大量實例與後端 DB 連線爆炸。
  - 理論上界：20 instance × `concurrency=80` ≈ **1,600 個同時由 Cloud Run 接受的請求**（見 Q3），不等於 DB 能扛 1,600 連線。
- **若被追問「沒壓測怎麼上線」**：應補「正式上線前會用 `db:seed:bulk` 灌資料 + k6 對 `/assets`、`/applications` 做分頁與審核路徑壓測，並依 p95 latency、5xx、Cloud SQL `num_backends` 調整 `max-instances` 與 `connection_limit`」。

---

#### Q2. 為什麼不用 scale-to-zero（`min-instances=0`）？流量歸零仍要付費的取捨？

**答：**

| 選項 | 優點 | 缺點 |
|------|------|------|
| `min-instances=1`（目前） | 無流量時也有一位 instance 可立即回應；適合 demo、作業展示、管理員偶爾登入 | **空閒仍計費**（CPU/記憶體保留） |
| `min-instances=0` | 無流量時接近零運算費 | 第一個請求 **冷啟動**（拉 image、Node 啟動、Prisma 連線）延遲明顯 |

**取捨結論**：本專案優先 **體驗穩定（避免冷啟動）**，而非極致省錢。若改為內部工具、流量極低且可接受 3–10 秒首包延遲，可改 `min-instances=0` 並用 Cloud Scheduler 定時 ping `/health` 減少冷啟動（仍非保證）。

---

#### Q3. `concurrency=80` 怎麼決定？Node 單執行緒，I/O 與 CPU 混在一起會不會有問題？

**答：**

- **設定位置**：[`deploy-backend-cloudrun.sh`](../scripts/gcp/deploy-backend-cloudrun.sh) `--concurrency 80`（接近 Cloud Run 常見預設區間 80–250）。
- **意義**：單一 instance 上，Cloud Run 最多將 **80 個請求同時交給同一個 Node 進程**處理；超過則由平台排隊或再開新 instance（直到 `max-instances`）。
- **Node 單執行緒**：
  - **I/O-bound**（Prisma 查 DB、GCS 串流上傳、JWT 驗證）：多數時間在等 I/O，event loop 可交錯處理多請求，80 在實務上常可接受。
  - **CPU-bound**（大檔轉碼、同步 bcrypt、大量 JSON）：會阻塞 event loop，80 可能讓延遲互相拖累。
- **本專案請求型態**：以 CRUD、分頁查詢為主，屬 **偏 I/O**；圖片上傳為 **streaming 寫入 GCS**（[`gcs-storage.adapter.ts`](../backend/src/infrastructure/storage/gcs-storage.adapter.ts)），未做 resize，CPU 壓力相對小。
- **風險與緩解**：
  - 若 p95 延遲隨併發飆升：降低 `concurrency`（例如 40）或提高 instance 數、把上傳改 **signed URL 直傳 GCS**。
  - 密碼雜湊若改為高 cost factor，應考慮 **worker thread** 或獨立 auth 服務。

---

### 資料庫與高併發

#### Q4. 1,600 併發打到後端，PostgreSQL 連線怎麼處理？Prisma connection pool？max 多少？

**答：**

- **先澄清「1,600」**：這是 **Cloud Run 請求併發上限**（20×80），不是 DB 連線數。實際打到 Postgres 的連線 ≈ **活躍 instance 數 × 每 instance Prisma pool 大小**。
- **現況實作**：[`prisma.client.ts`](../backend/src/infrastructure/database/prisma.client.ts) 使用 `new PrismaClient()`；生產 `DATABASE_URL` 建議帶 `connection_limit=5&pool_timeout=10`（見 [README](../README.md)），**未**使用 PgBouncer。
- **Prisma 行為**：每個 Cloud Run instance 一個 Node 進程 → 一個 Prisma Client → **獨立連線池**（預設 `connection_limit` 常見為 `num_cpus * 2 + 1` 量級，實際依 Prisma 版本與環境而定，**應在 Cloud SQL 監控上驗證**）。
- **粗算範例**（假設每 instance pool = 10）：20 instance × 10 ≈ **200 條連線** → 必須小於 Cloud SQL `max_connections`（依 tier，例如 db-g1-small 約數百）。
- **建議正式答案**：
  ```text
  DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=10"
  ```
  並用 **PgBouncer（transaction mode）** 或 Cloud SQL Auth Proxy + 連線池代理，把「instance 數 × pool」壓在 DB 上限內。
- **Cloud SQL 連線方式**：部署使用 `--add-cloudsql-instances`（Unix socket / connector），見 deploy 腳本；**不是**每個請求新建 TCP，但 pool 仍佔 DB backend slot。

---

#### Q5. 20 個 instance 各有一份 Prisma client，Cloud SQL 撐得住嗎？Auth Proxy / PgBouncer？

**答：**

| 機制 | 本專案 |
|------|--------|
| Cloud SQL Connector | **有**（`gcloud run deploy --add-cloudsql-instances`） |
| PgBouncer / AlloyDB Auth Proxy 連線池 | **無**（程式與 infra 腳本未配置） |
| 連線數治理 | **未**在程式碼層明確設定 |

**面試建議說法**：「MVP 用 Connector 直連 Cloud SQL；若 instance 擴到 20 且每 pool 5–10 連線，會在監控上看到 `num_backends` 上升，下一步會加 PgBouncer 或下修 `connection_limit` + `max-instances`。」

---

### 無狀態與 JWT

#### Q6. Refresh Token 存在哪？Redis 在技術選型有，實際部署在哪？

**答：**

| 項目 | 文件／架構圖 | **實際程式碼** |
|------|----------------|----------------|
| Refresh Token | [`docs/sequence-diagram.md`](sequence-diagram.md) 寫入 Redis | **未寫入 Redis** |
| 儲存位置 | — | 後端簽發 **JWT refresh token**（[`auth.service.ts`](../backend/src/services/auth/auth.service.ts)）；前端存 **`localStorage`**（[`frontend/src/store/auth.ts`](../frontend/src/store/auth.ts)） |
| Redis | Memorystore（[`bootstrap-cloudrun.sh`](../scripts/gcp/bootstrap-cloudrun.sh) 建立） | 部署時注入 `REDIS_URL`，但 **backend `src/` 內無 ioredis 使用**（僅 `package.json` 依賴，BullMQ 未接線） |

**Redis 部署**：規劃為 **GCP Memorystore for Redis 7**（private IP，`REDIS_HOST` / `REDIS_PORT`），與 Cloud Run 同 VPC 存取。

**誠實結論**：Redis 是 **基礎設施已備、應用尚未接入**；Refresh Token 目前是 **無狀態 JWT**，非 server-side session。

---

#### Q7. 某 instance 上使用者被登出（token revoke），其他 instance 怎麼知道失效？

**答：**

- **Access Token（15m，可設）**：各 instance 用同一 `JWT_SECRET` 驗證，**無需共享狀態**；過期即失效。
- **Refresh Token**：同樣為 JWT 驗簽（[`verifyRefreshToken`](../backend/src/services/auth/auth.service.ts)），**沒有 server-side revoke 清單**。
- **`POST /auth/logout`**：回 **204**，**未**刪除 Redis、未 blacklist token（[`auth.routes.ts`](../backend/src/routes/auth.routes.ts)）→ 登出主要是 **前端清掉 localStorage**。
- **跨 instance「登出」問題**：使用者在 A 登出後，refresh token 字串仍有效直到 JWT 過期；其他裝置仍可用 refresh 換 access。

**若要做到全域失效**：需 **Redis / DB 儲存 refresh token 白名單或 jti 黑名單**，logout 時寫入，所有 instance 驗 refresh 前查詢（與架構圖一致，但待實作）。

---

## 中機率

### CI/CD 與部署

#### Q8. GitHub Actions 的 GCP 憑證怎麼管？WIF 還是 Service Account Key？

**答：**

使用 **Workload Identity Federation（WIF）**，不是把 JSON key  commit 進 repo。

- Workflow：[`.github/workflows/deploy-cloudrun.yml`](../.github/workflows/deploy-cloudrun.yml)
- `google-github-actions/auth@v2` 參數：
  - `workload_identity_provider`: `${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}`
  - `service_account`: `${{ secrets.GCP_DEPLOYER_SERVICE_ACCOUNT }}`
- `permissions.id-token: write` 供 OIDC 交換短期憑證。

**優點**：無長期金鑰外洩風險；符合 GCP 建議做法。

---

#### Q9. Prisma migration 部署途中失敗，新舊 schema 不相容怎麼 rollback？有 backward-compatible migration 嗎？

**答：**

- **啟動流程**：[`backend/Dockerfile`](../backend/Dockerfile)  
  `CMD prisma migrate deploy && node dist/index.js`  
  → migration **失敗則 container 起不來**，新版本通常**不會接到流量**（視 Cloud Run 健康檢查與 rollout 設定）。
- **應用層 rollback**：[`docs/deploy-cloudrun.md`](deploy-cloudrun.md) — 將流量切回**上一個穩定 revision**（`gcloud run services update-traffic`）。**舊程式碼**可繼續跑。
- **DB schema rollback**：`migrate deploy` **沒有自動 down**；若新 migration 已套用且破壞相容性，需：
  1. 手動寫補救 migration，或
  2. 從備份還原 Cloud SQL（最後手段）。
- **本專案實務**：migration 多為 `ADD COLUMN`、enum 擴充，偏向 **expand**；程式碼上應遵守 **先 deploy 相容新舊欄位的程式，再跑 destructive migration**（目前未見嚴格文件化 checklist）。

**面試建議**：強調「**運算 rollback（revision）≠ schema rollback（migration）**」，生產會用 expand-contract 與 feature flag。

---

#### Q10. Smoke test 只測 `/health` 與登入，夠嗎？審核壞掉但 health 正常怎麼辦？

**答：**

- **現況**：[`scripts/gcp/smoke-test.sh`](../scripts/gcp/smoke-test.sh)  
  - 必測：`GET /health`（含 DB `SELECT 1`）  
  - 可選：`POST /auth/login`（需 `SMOKE_EMAIL` / `SMOKE_PASSWORD`）
- **不足**：未覆蓋 **審核流程**（`PATCH /applications/:id/approve`）、資產列表、上傳等核心路徑。
- **風險**：schema/邏輯錯誤若只影響業務 API，deploy 仍可能通過 smoke。
- **改進建議**：
  1. Post-deploy：用 admin token 跑一條 **最小 E2E**（建立申請 → approve → complete）。
  2. CI 階段已有 Vitest 路由測試（[`backend/src/routes/__tests__/`](../backend/src/routes/__tests__/)），與 smoke 互補。
  3. 可選 Synthetic Monitoring（Cloud Monitoring uptime + API check）。

---

### 觀測性

#### Q11. Cloud Monitoring 有設 alerting policy 嗎？Error rate 會自動通知嗎？

**答：**

- **Repo 內**：**沒有** Terraform / YAML 定義 alerting policy（僅 [`docs/deploy-cloudrun.md`](deploy-cloudrun.md) §8 **建議**監控項：5xx、latency、Cloud SQL CPU/connections、Redis memory）。
- **實際是否告警**：取決於 GCP 專案是否**手動**在 Console 設定；**非**本 repo 一鍵部署。
- **CI 失敗通知**：GitHub Actions deploy job fail（含 smoke fail）→ 依 repo 通知設定。

**面試說法**：「程式庫定義 SLO 與建議指標；正式環境會在 Monitoring 設 5xx > 1% 等 policy 並接到 Email/Slack。」

---

#### Q12. 擴到 20 個 instance，Logging 怎麼區分哪個 instance 的 log？

**答：**

Cloud Run 寫入 **Cloud Logging** 時，每筆 log 帶 **resource labels**，例如：

- `service_name`（如 `asset-backend`）
- `revision_name`
- `configuration_name`
- 請求級：`trace`（若接入 Cloud Trace）

**區分方式**：

1. Logs Explorer 篩選 `resource.type="cloud_run_revision"` + `revision_name`。
2. 單一請求用 **HTTP `X-Cloud-Trace-Context`** / Fastify request id（若實作）串聯。
3. **不需**自己記 instance id；平台已標 revision。

本專案 Fastify logger 為預設 JSON；**未**額外注入 custom `instanceId` 欄位（可加強）。

---

### 架構設計

#### Q13. Clean Architecture「可替換實作」有真的換過嗎？boilerplate 在專案規模下值得嗎？

**答：**

- **有實際替換的**：**Storage Adapter** — `STORAGE_DRIVER=local|gcs` 切換 [`LocalStorageAdapter` / `GCSStorageAdapter`](../backend/src/infrastructure/storage/)，[`storage.factory.ts`](../backend/src/infrastructure/storage/storage.factory.ts) 零改業務路由。
- **介面有、實作單一**：`IAssetRepository`、`IApplicationRepository` 等各一個 Prisma 實作，**未**換過第二套 DB。
- **是否值得**（誠實評估）：
  - **值得**：儲存、未來若接 ERP mock、測試 mock repo。
  - **代價**：多層 DTO / interface，小型 CRUD 專案略顯厚重。
- **面試結論**：「我們用 CA 換取 **測試與 GCS 切換** 的邊界清晰，不是為了抽象而抽象。」

---

#### Q14. GCS 圖片：後端 proxy 還是前端 signed URL？大量上傳會不會成為瓶頸？

**答：**

- **現況**：**後端 proxy（multipart）** — 前端 `POST /upload` → Fastify 收檔 → [`GCSStorageAdapter`](../backend/src/infrastructure/storage/gcs-storage.adapter.ts) `createWriteStream` 寫入 bucket → 回傳 public GCS URL。
- **不是** signed URL 直傳。
- **瓶頸**：
  - 頻寬與 Cloud Run **request timeout**、**concurrency** 佔用。
  - 大檔／高併發上傳時，後端 instance 成為 **單點管道**。
- **改進**：前端 **Signed URL / Resumable Upload** 直傳 GCS，後端只簽名與記錄 metadata（可降後端負載 80%+）。

---

## 開放性、考驗深度

#### Q15. 使用者量 ×10，架構要改哪裡？

**答（分層）**：

| 層級 | 現況瓶頸 | ×10 改動 |
|------|----------|----------|
| 前端 | 靜態 Cloud Run | CDN（Cloud CDN / LB）、快取 `index.html` 策略 |
| API | 單一 Cloud Run service | 調 `max-instances`、降 `concurrency`、讀寫分離 API（可選） |
| DB | 單一 Cloud SQL、Prisma 直連 | **PgBouncer**、讀 replica 給列表查詢、`connection_limit` 治理 |
| 快取 | Redis 未用 | 熱門列表 cache、rate limit、refresh token / session |
| 通知 | DB pull only | Redis pub/sub + SSE/WebSocket 或 polling |
| 圖片 | 後端 proxy GCS | Signed URL 直傳、CDN 快取物件 |
| 搜尋 | `contains` 模糊查 | 全文索引（PG `tsvector`）或 Elasticsearch（若需求升級） |
| 觀測 | 建議級文件 | SLO、alerting、分散式 trace |

本專案已有 **分頁 API**（`page`/`limit`，max 100），10k～100k 資產列舉靠索引與 DB tuning，非單機記憶體問題。

---

#### Q16. 為什麼 Cloud Run 而不是 GKE？什麼情況會選 GKE？

**答：**

| 選 Cloud Run（本專案） | 選 GKE |
|------------------------|--------|
| 課程／MVP、REST API、無狀態 | 需 DaemonSet、sidecar 網格、複雜網路策略 |
| 不想維運 control plane | 多語言工作負載、GPU、長連線 WebSocket 大規模 |
| CI/CD 簡單（build → deploy） | 已有 K8s 團隊與 GitOps 成熟 |
| 按請求伸縮足夠 | 需要 **固定大池**、極致調度控制 |

**會改選 GKE 的訊號**：長連線即時通知全站、多租戶網路隔離、自訂 CNI、或必須跑非 container-friendly 中介軟體且 Cloud Run 不支援。

---

#### Q17. 選 Fastify 因效能比 Express 好，但 CPU-bound（圖片處理）怎麼辦？

**答：**

- **選 Fastify 原因**：較低 overhead、schema 驗證、適合 I/O 密集 API（與本專案主路徑一致）。
- **本專案圖片**：**未**在 Node 做 resize／浮水印，僅串流上傳 → **仍偏 I/O**。
- **若未來 CPU-bound**：
  1. **worker_threads** / `piscina` 處理影像。
  2. 丟到 **Cloud Tasks + Cloud Run Job** 或 **GCS trigger + Cloud Functions** 非同步處理。
  3. 專用 **media microservice**（可 CPU 優化實例類型），與 API 分離擴展。

**原則**：Node API 層保持 I/O；CPU 工作 **移出 request path**。

---

## 附錄：關鍵設定一覽

```bash
# scripts/gcp/deploy-backend-cloudrun.sh（摘要）
--min-instances 1
--max-instances 20
--concurrency 80
--add-cloudsql-instances "${DB_INSTANCE_CONNECTION_NAME}"
STORAGE_DRIVER=gcs
REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}   # 已注入，應用層尚未使用
```

```typescript
// prisma.client.ts — 無自訂 pool
new PrismaClient({ log: [...] });
```

```typescript
// auth — Refresh Token 為 JWT，非 Redis session
signRefreshToken / verifyRefreshToken
```

---

## 附錄：文件與實作差異（口試時主動說明加分）

| 項目 | 文件 | 實作 |
|------|------|------|
| Refresh Token 存 Redis | sequence-diagram、architecture | JWT + localStorage |
| Redis 用途 | Session、rate limit | 僅 deploy env，無程式碼 |
| JWT 演算法 | architecture 寫 RS256 | 實際為 HS256（`JWT_SECRET`） |
| 壓力測試 | — | 未納入 repo |
| Alerting policy | deploy-cloudrun 建議 | 未 IaC 化 |

建議口試結尾：「我們清楚 MVP 與 production-grade 的差距，下一階段會補 Redis session、連線池治理、E2E smoke 與 k6 壓測。」

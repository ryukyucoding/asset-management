# Redis 架構與 Key 命名空間

## 邏輯位置

Redis 位於 **Data Layer**，與 Cloud SQL（PostgreSQL）並列，作為 Backend 的 **輔助儲存**（快取、Session、計數、佇列 broker）。前端與使用者 **不直連** Redis。

```
Browser → Frontend (Cloud Run) → Backend (Cloud Run) → [Prisma → PostgreSQL]
                                                    → [Redis Adapters → Memorystore]
```

本地開發：`docker-compose` 的 `redis:6379`；GCP：Memorystore private IP，Cloud Run 經 **VPC Connector** 以 `REDIS_URL` 連線。

## Key 前綴規範

| 前綴 | 用途 | 範例 | TTL |
|------|------|------|-----|
| `rate-limit:auth-login:` | 登入暴力防護 | `rate-limit:auth-login:127.0.0.1` | 60s 視窗 |
| `refresh:` | Refresh Token 伺服端 session | `refresh:{userId}:{jti}` | 7d（與 JWT 一致） |
| `token-deny:` | Access Token 登出黑名單 | `token-deny:{jti}` | 與 access token 過期一致 |
| `cache:assets:` | 資產列表查詢快取 | `cache:assets:{sha256(query)}` | 60s |
| `cache:asset:` | 單一資產詳細快取 | `cache:asset:{id}` | 5min |
| `cache:asset-stats:` | 三狀態統計（available / pendingRepair / inRepair） | `cache:asset-stats:all` 或 `cache:asset-stats:user:{id}` | 60s |
| `cache:user:` | 使用者 profile 快取 | `cache:user:{userId}` | 5min |
| `cache:user-by-role:` | 角色 → user id 列表（通知派送用） | `cache:user-by-role:ADMIN` | 5min |
| `cache:users:` | 管理員用戶列表快取 | `cache:users:all` | 5min |
| `cache:notifications:` | 通知列表快取 | `cache:notifications:{userId}` | 2min |
| `serial:` | 資產序號計數器（DB 為真相） | `serial:IT` | 無 |
| `unread:` | 通知未讀計數 | `unread:{userId}` | 24h |
| `idem:` | Idempotency-Key 重試去重 | `idem:{userId}:{key}` | 10min |
| `bull:` | BullMQ 內部 key | （由 BullMQ 管理） | 依 job |

定義於 [`backend/src/infrastructure/cache/redis.keys.ts`](../backend/src/infrastructure/cache/redis.keys.ts)。

## 與 PostgreSQL 分工

- **PostgreSQL**：使用者、資產、申請、通知等持久化真相來源（SoT）。
- **Redis**：可重建或短期狀態；Redis 不可用時 API 降級（略過快取／允許登入 rate limit fallback）。

### 序號 (`serial:`) 的特別說明

Memorystore Basic Tier **無持久化**，重啟即清空。為了避免序號撞號，`serial-counter.ts` 採用以下策略：

1. INCR 前先 `EXISTS`，若 key 不存在則先 `SET NX seed = MAX(serialNo) FROM DB`
2. 路由層 `asset.routes.ts` 在 `prisma.create` 撞到 `serialNo` unique constraint 時：
   - 視為快取漂移
   - 呼叫 `reseedSerialCounter()` 從 DB 重新對齊
   - 最多重試 3 次
3. **DB 才是序號的真相來源**，Redis 僅為效能加速器

## Admin 端點

只有 `ADMIN` / `SENIOR_ADMIN` 可呼叫，所有操作都會寫 audit log。pattern / key 都必須在白名單前綴內。

| 端點 | 用途 |
|------|------|
| `GET /admin/redis/summary` | 各前綴 key 數 + 應用層 cache hit/miss 指標 |
| `GET /admin/redis/keys?pattern=&cursor=` | SCAN（非 KEYS）、有上限 500、分頁 cursor |
| `GET /admin/redis/key?key=` | 看單一 key 的 TYPE / TTL / 值 |
| `DELETE /admin/redis/keys?pattern=` | 清快取（**禁止** 對 `refresh:` 或 `serial:`） |
| `GET /admin/queue` | Bull Board UI — 查看通知佇列 job 狀態（BullMQ） |

## 程式對照

| 模組 | 檔案 |
|------|------|
| 連線 / 通用操作 | `infrastructure/cache/redis.client.ts` |
| Token Store | `infrastructure/cache/redis-token.store.ts` |
| 資產列表快取 | `infrastructure/cache/asset-list.cache.ts` |
| 資產詳細快取 + 統計快取 | `infrastructure/repositories/cached-asset.repository.ts` + `infrastructure/cache/asset-stats.cache.ts` |
| 通知列表快取 | `infrastructure/cache/notifications-list.cache.ts` |
| 使用者快取 | `infrastructure/repositories/cached-user.repository.ts` |
| 未讀計數 | `infrastructure/cache/unread-count.cache.ts` |
| 序號 INCR + reseed | `infrastructure/cache/serial-counter.ts` |
| Cache hit/miss metrics | `infrastructure/cache/cache-metrics.ts` |
| Idempotency middleware | `middleware/idempotency.middleware.ts` |
| 通知佇列 | `infrastructure/queue/notification.queue.ts` |
| Admin 端點 | `routes/admin-redis.routes.ts` |

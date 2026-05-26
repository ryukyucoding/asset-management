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
| `serial:` | 資產序號原子遞增 | `serial:IT` | 無 |
| `bull:` | BullMQ 內部 key | （由 BullMQ 管理） | 依 job |

定義於 [`backend/src/infrastructure/cache/redis.keys.ts`](../backend/src/infrastructure/cache/redis.keys.ts)。

## 與 PostgreSQL 分工

- **PostgreSQL**：使用者、資產、申請、通知等持久化真相來源（SoT）。
- **Redis**：可重建或短期狀態；Redis 不可用時 API 降級（略過快取／允許登入 rate limit fallback）。

## 程式對照

| 模組 | 檔案 |
|------|------|
| 連線 / 通用操作 | `infrastructure/cache/redis.client.ts` |
| Token Store | `infrastructure/cache/redis-token.store.ts` |
| 資產列表快取 | `infrastructure/cache/asset-list.cache.ts` |
| 序號 INCR | `infrastructure/cache/serial-counter.ts` |
| 通知佇列 | `infrastructure/queue/notification.queue.ts` |

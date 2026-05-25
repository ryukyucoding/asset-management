# Testing Strategy

## 測試金字塔

| 層級 | 工具 | 指令 | 說明 |
|------|------|------|------|
| 單元測試 | Vitest | `pnpm test:coverage` | Services / Routes / Middleware，mock 資料層 |
| 整合測試 | Vitest + PostgreSQL | `pnpm test:integration` | 真實 DB，驗證申請 → 審核 → 完成流程 |
| E2E | Playwright | `pnpm test:e2e` | 瀏覽器端完整使用者流程 |

## 覆蓋率門檻（CI enforce）

Backend 單元測試覆蓋率門檻（`vitest.config.ts`）：

| 指標 | 門檻 |
|------|------|
| lines / statements | **80%** |
| branches | **75%** |
| functions | **75%** |

覆蓋範圍：`routes/`、`services/`、`middleware/`、`dtos/`、`domain/errors/`  
Infrastructure（Prisma Repository、Storage）由整合測試驗證。

## 單元測試範圍

- **Route Handlers** — API 請求/回應、驗證、HTTP status
- **AuthService** — JWT 簽發、HMAC 密碼雜湊
- **ApplicationService** — 申請生命週期、審核流程
- **NotificationService** — 站內通知
- **resolveApprovalSteps** — 審核步驟路由（一般 / 高價值設備）
- **vi.mock** — 隔離 Repository，專注業務邏輯

## 整合測試範圍

- 真實 PostgreSQL（非 mock）
- 測試前需執行 `pnpm db:migrate:prod`
- 覆蓋流程：
  - 申請 → ADMIN 核准 → 填寫維修細節 → 完成
  - ADMIN 拒絕 → 資產恢復 AVAILABLE
  - 高價值設備：ADMIN → SENIOR_ADMIN 兩步審核

## E2E 測試範圍

- **Playwright** — Chromium / Firefox / WebKit（CI 與本地皆跑三瀏覽器）
- CI 自動 retry 2 次
- 完整流程：登入 → 提交維修 → 管理員核准 → 維修完成

## CI Pipeline

```
backend:  unit + coverage (80%) → integration → build
frontend: type-check + unit + build
e2e:      seed DB → backend + frontend preview → Playwright
```

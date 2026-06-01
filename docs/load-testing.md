# Load Testing (k6)

本地壓力測試使用 [k6](https://k6.io/)，直接打 Backend API（預設 `http://localhost:3000`）。

## 前置條件

```bash
docker compose up -d
cp backend/.env.example backend/.env   # 若尚未建立
pnpm --filter backend db:migrate:prod
pnpm db:seed
pnpm dev:backend                       # 另一個 terminal
```

安裝 k6（擇一）：

```bash
brew install k6
# 或未安裝 k6 時，run-all.sh 會自動用 docker run grafana/k6
```

## 測試場景

| 指令 | 腳本 | 說明 |
|------|------|------|
| `pnpm test:load` | `smoke.js` | 健康檢查 + 低併發讀取 |
| `pnpm test:load:read` | `read-heavy.js` | 一般使用者瀏覽（assets / stats / notifications） |
| `pnpm test:load:admin` | `admin-read.js` | 管理員查申請列表 |
| `pnpm test:load:stress` | `stress.js` | 逐步提高 VU 找 latency 拐點 |
| `pnpm test:load:spike` | `spike.js` | 瞬間流量高峰 |
| `pnpm test:load:soak` | `soak.js` | 25 VU × 5 分鐘浸泡 |
| `pnpm test:load:all` | `run-all.sh` | 依序跑完以上全部 |

環境變數：

```bash
BASE_URL=http://localhost:3000 pnpm test:load
K6_STRESS_PEAK=100 pnpm test:load:stress
K6_SPIKE_VUS=80 pnpm test:load:spike
```

## 注意事項

- **Login rate limit**：同一 IP 60 秒內 >10 次 login 會被擋；腳本在 `setup()` 登入一次，VU 重用 token。
- 本地 soak 預設 5 分鐘；production 可設 `K6_SOAK_DURATION=30m`。
- GCP 壓測請先設 Budget Alert 並限制 `max-instances`，詳見課堂討論 checklist。

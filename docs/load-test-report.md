# 壓力測試報告（簡報版）

**專案**：資產管理系統 · Production Cloud Run  
**工具**：k6 v2.0  
**目標**：`https://cloud-native-backend-11959477316.asia-east1.run.app`  
**日期**：2026-06-01

---

## Slide 1｜測試方法

### 測什麼

用 k6 模擬 Virtual User（VU）持續打 Backend API，驗證：

- 延遲（p95）與錯誤率
- Cloud Run 自動擴展是否觸發
- 長時間運行是否穩定

### 被測環境

| 項目 | 設定 |
|------|------|
| Cloud Run | min 1 / **max 20 instances** |
| Concurrency | **80** / instance |
| 理論並發上限 | 20 × 80 = **1,600** 同時 HTTP 請求 |
| DB 連線池 | 5 / instance → 最多約 **100** 條連線 |

### 測試場景（精選）

| 場景 | 目的 | 峰值 VU | 時長 |
|------|------|---------|------|
| Read-heavy | 模擬日常瀏覽 | 50 | 3 min |
| Stress | 模擬流量高峰 | 400 | 3 min |
| Soak | 長時間穩定性 | 40 | **15 min** |

> VU = 虛擬使用者；實際並發 request 取決於請求頻率與 sleep 時間，不等於 VU 數。

---

## Slide 2｜測試結果

| 場景 | 負載 | 吞吐量 | p95 延遲 | 錯誤率 | 結論 |
|------|------|--------|----------|--------|------|
| 日常讀取 | 50 VU | ~54 req/s | **70 ms** | 0% | 🟢 正常流量 OK |
| 流量高峰 | 400 VU | ~450 req/s | **~700 ms** | ~0% | 🟢 高峰仍穩定 |
| 長時間浸泡 | 40 VU × 15 min | ~58 req/s | **42 ms** | 0.09% | 🟢 長時間穩定 |

**關鍵觀察**

- 400 VU / ~450 req/s 下 **零錯誤**，p95 仍 < 1 秒
- Cloud Run **有自動擴展**（instance 數隨流量上升）
- 15 分鐘 Soak 錯誤率 < 0.1%，未見明顯性能衰退

---

## Slide 3｜結論與瓶頸

### 系統可承載範圍

> 在 **~400 VU / ~450 req/s** 以下，系統 p95 < 1s、近乎零錯誤，Cloud Run 自動擴展正常。

### 架構瓶頸

```
請求 → Cloud Run（max 1,600 並發）→ Cloud SQL（~100 連線）
                                         ↑
                                    首要瓶頸
```

| 層級 | 上限 | 400 VU 時 |
|------|------|-----------|
| Cloud Run 並發 | 1,600 | 未觸頂 |
| Cloud Run instance | 20 | 未觸頂 |
| **DB 連線池** | **~100** | 可能先飽和 |

### 極限探索（附註）

加重測試（800 VU + 並行請求）時，吞吐量達 ~2,140 req/s，錯誤率約 **15%**——確認 **Database 連線池** 為擴展瓶頸，Cloud Run 本身仍有餘裕。此為刻意找上限，非日常預期負載。

### 後續可優化

- 調整 `connection_limit` 或升級 Cloud SQL 規格
- 對熱門讀取 API 強化 Redis 快取，降低 DB 壓力

---

## 附錄｜重現指令

```bash
pnpm test:load:production        # 標準梯次（~27 min）
pnpm test:load:production:heavy # 極限探索（~32 min，選用）
```

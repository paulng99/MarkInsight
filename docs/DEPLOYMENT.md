# MarkInsight 公開部署指南

本文件說明如何把 MarkInsight 安全地部署到公開 URL。預設示範密碼 `password` **不可**在正式環境生效。

本地筆電 / Docker Compose 離線示範流程（`MARKINSIGHT_ANALYSIS_DEMO=true`、以 `password` 登入）維持不變；見 [README](../README.md) 與下方「本地示範」。

---

## (a) 環境變數清單

複製 `.env.example` 為 `.env`，再按正式環境調整。標示 **密鑰** 的項目不可提交、不可寫入 UI / 資料庫。

### 必要（正式環境）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `DATABASE_URL` | **是** | PostgreSQL 連線字串，例如 `postgresql://USER:PASSWORD@HOST:5432/markinsight?schema=public` |
| `NEXTAUTH_URL` | 否 | 瀏覽器實際開啟的公開 origin（例如 `https://markinsight.example.com`）。勿用 `localhost` 除非只在本機 |
| `NEXTAUTH_SECRET` 或 `AUTH_SECRET` | **是** | Auth.js 簽章用隨機字串。產生：`openssl rand -base64 32`（兩者擇一即可；建議兩個都設成同一值） |
| `OPENROUTER_API_KEY` | **是** | 正式評分／結構分析用。沒有金鑰且未開示範模式時，分析工作會失敗 |
| `STORAGE_PROVIDER` | 否 | 正式環境請用 `local`（目前唯一實作） |
| `STORAGE_LOCAL_DIR` | 否 | 必須指向**持久化磁碟區**路徑（Compose 預設 `/app/.data/uploads`）。沒有 volume 時重新部署會遺失上載檔 |

### 建議設定

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `OPENROUTER_BASE_URL` | 否 | 預設 `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL_ALLOWLIST` | 否 | 逗號分隔的模型 id；空白則從 OpenRouter 載入多模態目錄（仍經伺服器驗證） |
| `MARKINSIGHT_LLM_TIMEOUT_MS` | 否 | 單次 LLM HTTP 逾時（毫秒），預設 `120000` |
| `UPLOAD_MAX_BYTES` | 否 | 上載大小上限（位元組），預設 `104857600`（100MB） |
| `AUTH_TRUST_HOST` | 否 | 容器／反向代理後方建議 `true`（Compose 已設） |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | 否 | `zh-HK`（預設）或 `en` |

### 示範帳戶（正式環境務必收緊）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `MARKINSIGHT_ANALYSIS_DEMO` | 否 | **正式環境必須為 `false` 或未設定。** 為 `true` 時會走離線假分析，且在未設定 `MARKINSIGHT_DEMO_PASSWORD` 時允許以字面密碼 `password` 登入示範帳戶 — 公開站台絕不可如此 |
| `MARKINSIGHT_DEMO_PASSWORD` | **是**（若設定） | 若要在非 `ANALYSIS_DEMO` 環境保留示範帳戶，設成長度 **≥ 12** 的強密碼。太短或空字串會**停用**示範登入並在伺服器印出警告。未設定且 `ANALYSIS_DEMO` 不為 `true` 時，示範登入完全停用（預設 `password` 永不生效） |

### 可選

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `JINA_API_KEY` | **是** | 可選；不阻擋 MVP |
| `OPENROUTER_EXAM_STRUCTURE_MODEL` / `OPENROUTER_SCORING_MODEL` | 否 | 預設模型提示（仍受 allowlist 約束） |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | 否 | OpenRouter 歸因標頭 |
| `FAL_KEY` | **是** | 預留；scaffold 未使用 |

### 首次建立真實帳戶（seed，可選）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `MARKINSIGHT_SEED_ADMIN_EMAIL` | 否 | 見下方 go-live |
| `MARKINSIGHT_SEED_ADMIN_PASSWORD` | **是** | 長度 ≥ 12；腳本不會把密碼寫進 log |
| `MARKINSIGHT_SEED_TEACHER_EMAIL` / `MARKINSIGHT_SEED_TEACHER_PASSWORD` | 部分為密鑰 | 可選同步建立教師 |
| `MARKINSIGHT_SEED_SCHOOL_ID` | 否 | 教師所屬學校 id（預設 `demo_school`） |

---

## (b) 架構約束（影響託管方式）

以下皆由現有程式碼證實，部署時必須遵守：

### 1. 分析工作在行程內執行（不可水平擴充 web）

`src/lib/jobs/analyze-exam.ts` 以 **in-process** 方式排程／執行 `AnalysisJob`（見 `docs/architecture.md`）。工作狀態在單一 Node 程序記憶體與資料庫之間銜接。

**正式環境請只跑恰好一個 web 實例。** 多副本會導致工作遺失、重複或狀態不一致。需要擴充時，須先改為外部佇列（尚未實作）。

### 2. 上載使用本機檔案系統

`STORAGE_PROVIDER=local` 將試卷／答卷寫入 `STORAGE_LOCAL_DIR`（Compose：`/app/.data/uploads`，掛在 `markinsight_data` volume）。

- 必須掛載**持久化 volume**
- 沒有 volume 時，重新部署／重建容器會遺失檔案
- 多實例無法共用本機目錄（與「單實例」約束一致）

### 3. 資料庫 schema 啟動步驟

Dockerfile 的 `ENTRYPOINT` 為 `docker/entrypoint.sh`，正式啟動順序為：

1. 等待 PostgreSQL（`DATABASE_HOST` / `DATABASE_PORT`）
2. `prisma db push --schema=./prisma/schema.prisma --skip-generate`
3. 清除 loopback 的 `NEXTAUTH_URL` / `AUTH_URL`（若有）
4. `exec node server.js`（Next.js standalone）

**Compose 正式啟動指令：**

```bash
cp .env.example .env
# 編輯 .env：設定密鑰、NEXTAUTH_URL=https://你的網域、MARKINSIGHT_ANALYSIS_DEMO=false
# 勿在正式 .env 留下 ANALYSIS_DEMO=true
docker compose up --build -d
```

**非 Compose、已建好 image 時**，等效為：確保 `DATABASE_URL` 可連，執行與 entrypoint 相同的 `prisma db push`，再 `node server.js`（或 `npm run start` 於非 standalone 建置）。

本機開發（非 Docker）：

```bash
npx prisma db push
npm run build && npm run start
```

---

## (c) Go-live 檢查清單

1. **密鑰與 URL**
   - [ ] `NEXTAUTH_SECRET` / `AUTH_SECRET` 已用 `openssl rand -base64 32` 產生
   - [ ] `NEXTAUTH_URL` 為公開 HTTPS（或實際使用的 origin）
   - [ ] `OPENROUTER_API_KEY` 已設定；`MARKINSIGHT_ANALYSIS_DEMO` 為 `false` 或未設定
   - [ ] 未設定弱的 `MARKINSIGHT_DEMO_PASSWORD`；若不需要示範帳戶則保持未設定

2. **儲存與擴充**
   - [ ] 單一 web 實例
   - [ ] `STORAGE_LOCAL_DIR` 在持久化 volume 上
   - [ ] Postgres 資料亦在持久化 volume（Compose：`markinsight_pg`）

3. **建立第一個真實管理員（不要用示範帳戶）**

   管理後台「新增教師」目前仍使用開發用 stub 密碼 `password`（見 API 註解）。正式環境請用 seed 腳本建立有真實 `passwordHash` 的帳戶：

   ```bash
   export DATABASE_URL='postgresql://…'
   export MARKINSIGHT_SEED_ADMIN_EMAIL='you@school.edu.hk'
   export MARKINSIGHT_SEED_ADMIN_PASSWORD='your-strong-password-here'
   # 可選教師：
   # export MARKINSIGHT_SEED_TEACHER_EMAIL='teacher@school.edu.hk'
   # export MARKINSIGHT_SEED_TEACHER_PASSWORD='another-strong-password'
   # export MARKINSIGHT_SEED_SCHOOL_ID='demo_school'
   npm run db:seed-admin
   ```

   腳本可重跑（idempotent），**不會**把密碼印到 log。

4. **清除本機示範資料（若此資料庫曾跑過本地 demo）**
   - 有 `passwordHash` 的資料庫使用者**優先**於示範登入政策。若曾 bootstrap 過 `demo_teacher` / `demo_student`（或電郵 `*@example.com`），其雜湊可能仍對應字面 `password`。
   - 正式上線前請刪除這些列，或用 seed／SQL 換成強密碼雜湊。

5. **煙霧驗證**
   - [ ] 開啟登入頁：不應出現示範帳戶區塊或字面 `password` 提示
   - [ ] 以 seed 管理員登入成功；以 `admin@example.com` / `password` 必須失敗
   - [ ] 教師開卷 → 上載 → 結構分析；學生上載答卷 → 評分（需有效 OpenRouter）

---

## 本地示範（筆電 / Compose）— 維持舊行為

以下組合必須與改動前相同：

1. `.env` 中 `MARKINSIGHT_ANALYSIS_DEMO=true`
2. **不要**設定 `MARKINSIGHT_DEMO_PASSWORD`（或從 `.env` 移除）
3. 登入頁顯示示範帳戶，密碼提示為 `password`
4. `admin@example.com` / `teacher@example.com` / `student@example.com` 皆可以 `password` 登入

`.env.example` 預設已將 `MARKINSIGHT_ANALYSIS_DEMO=true`，方便 `cp .env.example .env` 後直接本機示範。正式部署前務必改為 `false`。

# MarkInsight 公開部署指南

本文件說明如何把 MarkInsight 安全地部署到公開 URL。部署方式以 **任何 Linux VPS + Docker** 為主路徑；不依賴 Railway、Coolify 或其他單一平台。Coolify 及其他 PaaS 僅見文末附錄。

預設示範密碼 `password` **不可**在正式環境生效。本地筆電／`docker-compose.yml` 離線示範須在 `.env` **手動**設定 `MARKINSIGHT_ANALYSIS_DEMO=true`（`.env.example` 預設為 `false`），才可以 `password` 登入示範帳戶；見 [README](../README.md) 與下方「本地示範」。

**硬性約束（部署前必讀）：**

1. **Web 只可跑恰好一個實例。** 分析工作在行程內執行；不可設定 `deploy.replicas` 或多副本。
2. **上載目錄必須使用命名 volume。** 不可改成匿名 volume，也不可省略；否則重新部署會遺失檔案。
3. **公開站台必須使用 HTTPS。** 管理後台新建教師時，一次性臨時密碼會以 JSON 回應回傳；若以明文 HTTP 提供，密碼可能被竊聽。

---

## (a) 環境變數清單

複製 `.env.example` 為 `.env`，再按正式環境調整。標示 **密鑰** 的項目不可提交、不可寫入 UI／資料庫。**切勿在聊天工具中貼上真實密鑰。**

### 必要（正式環境）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `POSTGRES_USER` | 否 | 正式 Compose 範例的 Postgres 使用者名稱（必須在 `.env` 設定；範例檔不會寫死密碼） |
| `POSTGRES_PASSWORD` | **是** | 正式 Compose 範例的 Postgres 密碼。請用 `openssl rand -base64 32` 產生；避免使用 `/`、`+`、`=` 等會破壞 URL 的字元，或以 URL 編碼後再寫入 `DATABASE_URL` |
| `POSTGRES_DB` | 否 | 正式 Compose 範例的資料庫名稱 |
| `DATABASE_URL` | **是** | PostgreSQL 連線字串。**必須**與 `POSTGRES_USER`／`POSTGRES_PASSWORD`／`POSTGRES_DB` 使用相同數值，並以 Compose 服務名 `db` 作為主機（不可用 `localhost`）。示例：`postgresql://USER:PASSWORD@db:5432/DBNAME?schema=public` |
| `NEXTAUTH_URL` 或 `AUTH_URL` | 否 | 瀏覽器實際開啟的公開 origin。公開站台必須為 `https://…`（例如 `https://markinsight.example.com`），且必須與瀏覽器網址一致 |
| `NEXTAUTH_SECRET` 或 `AUTH_SECRET` | **是** | Auth.js 簽章用隨機字串。產生：`openssl rand -base64 32`（兩者擇一即可；建議兩個都設成同一值） |
| `OPENROUTER_API_KEY` | **是** | 正式評分／結構分析用。沒有金鑰且未開示範模式時，分析工作會失敗 |
| `STORAGE_PROVIDER` | 否 | 正式環境請用 `local`（目前唯一實作） |
| `STORAGE_LOCAL_DIR` | 否 | 必須指向**持久化磁碟區**路徑（正式 Compose 範例：`/app/.data/uploads`）。沒有命名 volume 時重新部署會遺失上載檔 |

### 建議設定

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `OPENROUTER_BASE_URL` | 否 | 預設 `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL_ALLOWLIST` | 否 | 逗號分隔的模型 id；空白則從 OpenRouter 載入多模態目錄（仍經伺服器驗證） |
| `MARKINSIGHT_LLM_TIMEOUT_MS` | 否 | 單次 LLM HTTP 逾時（毫秒），預設 `120000` |
| `UPLOAD_MAX_BYTES` | 否 | 上載大小上限（位元組），預設 `104857600`（100MB） |
| `AUTH_TRUST_HOST` | 否 | 容器／反向代理後方建議 `true`（Compose 範例已設） |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | 否 | `zh-HK`（預設）或 `en` |

### 示範帳戶（正式環境務必收緊）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `MARKINSIGHT_ANALYSIS_DEMO` | 否 | **正式環境必須為 `false` 或未設定。** 正式 Compose 範例預設為 `false`。為 `true` 時會走離線假分析，且在未設定 `MARKINSIGHT_DEMO_PASSWORD` 時允許以字面密碼 `password` 登入示範帳戶 — 公開站台絕不可如此 |
| `MARKINSIGHT_DEMO_PASSWORD` | **是**（若設定） | 若要在非 `ANALYSIS_DEMO` 環境保留示範帳戶，設成長度 **≥ 12** 的強密碼。太短或空字串會**停用**示範登入並在伺服器印出警告。未設定且 `ANALYSIS_DEMO` 不為 `true` 時，示範登入完全停用（預設 `password` 永不生效） |

### 可選

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `JINA_API_KEY` | **是** | 可選；不阻擋 MVP |
| `OPENROUTER_EXAM_STRUCTURE_MODEL` / `OPENROUTER_SCORING_MODEL` | 否 | 預設模型提示（仍受 allowlist 約束） |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | 否 | OpenRouter 歸因標頭 |
| `FAL_KEY` | **是** | 預留；scaffold 未使用 |

### 首次建立／重設真實帳戶（seed）

| 變數 | 密鑰？ | 說明 |
|------|--------|------|
| `MARKINSIGHT_SEED_ADMIN_EMAIL` | 否 | 見下方 go-live。**不可**使用 `@example.com` 或示範身分；`seed-admin` 會在寫入資料庫前拒絕並顯示「此電郵屬於示範帳戶用途，不能作為正式管理員。請改用學校的真實電郵地址。」 |
| `MARKINSIGHT_SEED_ADMIN_PASSWORD` | **是** | 長度 ≥ 12；腳本不會把密碼寫進 log |
| `MARKINSIGHT_SEED_TEACHER_EMAIL` / `MARKINSIGHT_SEED_TEACHER_PASSWORD` | 部分為密鑰 | 可選同步建立／重設教師 |
| `MARKINSIGHT_SEED_SCHOOL_ID` | 否 | 教師所屬學校 id（預設 `demo_school`；非 `demo_school` 時學校顯示名稱預設為 `School`，不會寫成「Demo School」） |
| `MARKINSIGHT_SEED_SCHOOL_NAME` | 否 | 當 `MARKINSIGHT_SEED_SCHOOL_ID` **不是** `demo_school` 時，可選設定學校顯示名稱；未設則為 `School`。`demo_school` 一律顯示為 `Demo School`（此變數無效） |

---

## (b) 架構約束（影響託管方式）

以下皆由現有程式碼證實，部署時必須遵守：

### 1. 分析工作在行程內執行（不可水平擴充 web）

`src/lib/jobs/analyze-exam.ts` 以 **in-process** 方式排程／執行 `AnalysisJob`（見 `docs/architecture.md`）。工作狀態在單一 Node 程序記憶體與資料庫之間銜接。

**正式環境請只跑恰好一個 web 實例。** 多副本會導致工作遺失、重複或狀態不一致。需要擴充時，須先改為外部佇列（尚未實作）。正式 Compose 範例只有一個 `web` 服務，且不得加入 `deploy.replicas`。

### 2. 上載使用本機檔案系統

`STORAGE_PROVIDER=local` 將試卷／答卷寫入 `STORAGE_LOCAL_DIR`（正式 Compose：`/app/.data/uploads`，掛在命名 volume `markinsight_uploads`）。

- 必須掛載**命名 volume**
- 沒有 volume 時，重新部署／重建容器會遺失檔案
- 多實例無法共用本機目錄（與「單實例」約束一致）

### 3. 資料庫 schema 啟動步驟

Dockerfile 的 `ENTRYPOINT` 為 `docker/entrypoint.sh`，正式啟動順序為：

1. 等待 PostgreSQL（`DATABASE_HOST` / `DATABASE_PORT`）
2. `prisma db push --schema=./prisma/schema.prisma --skip-generate`
3. 清除 loopback 的 `NEXTAUTH_URL` / `AUTH_URL`（若有）
4. `exec node server.js`（Next.js standalone）

本機開發（非 Docker）：

```bash
npx prisma db push
npm run build && npm run start
```

### 4. 公開站台必須使用 HTTPS

管理後台「建立教師」會把**一次性臨時密碼**放在 API 的 JSON 回應中回傳（畫面亦只顯示一次）。若站台以明文 HTTP 對外提供，該密碼可能在網路上被竊聽。

因此：

- 公開 URL **必須**使用 HTTPS（反向代理終止 TLS；見下方 Caddy／nginx）。
- 將 `NEXTAUTH_URL`（以及建議一併設定的 `AUTH_URL`）設為該 HTTPS origin，例如：

```bash
NEXTAUTH_URL=https://markinsight.example.com
AUTH_URL=https://markinsight.example.com
```

兩者必須與瀏覽器實際開啟的網址一致。

---

## (c) Any Linux VPS（建議主路徑）

本節適用於任何已安裝 Docker 的 Linux 虛擬主機（DigitalOcean、Linode、AWS EC2、自建機房等）。使用倉庫內現有 `Dockerfile` 與 `docker-compose.prod.example.yml`，不綁定特定控制台。

### 1. 安裝 Docker

在 Ubuntu／Debian 類系統可依 [Docker 官方文件](https://docs.docker.com/engine/install/) 安裝 Docker Engine 與 Compose 外掛，完成後確認：

```bash
docker --version
docker compose version
```

### 2. 複製程式庫

```bash
git clone <your-markinsight-repo-url> MarkInsight
cd MarkInsight
```

### 3. 建立 `.env`（產生密鑰；切勿在聊天中貼上）

```bash
cp .env.example .env
```

以編輯器開啟 `.env`，至少設定：

```bash
# 在伺服器本機產生，不要貼到聊天或提交到 git
openssl rand -base64 32   # 用作 NEXTAUTH_SECRET / AUTH_SECRET
openssl rand -base64 32   # 用作 POSTGRES_PASSWORD（建議再過濾掉 / + =）
```

`.env` 重點示例（**請替換成你自己產生的值，以下為佔位**）。`POSTGRES_*` 與 `DATABASE_URL` **必須一致**，且 `DATABASE_URL` 的主機名為 `db`：

```bash
POSTGRES_USER=markinsight
POSTGRES_PASSWORD=<openssl-output>
POSTGRES_DB=markinsight
DATABASE_URL=postgresql://markinsight:<openssl-output>@db:5432/markinsight?schema=public

NEXTAUTH_URL=https://markinsight.example.com
AUTH_URL=https://markinsight.example.com
NEXTAUTH_SECRET=<openssl-output>
AUTH_SECRET=<same-as-NEXTAUTH_SECRET>
OPENROUTER_API_KEY=<your-key>
MARKINSIGHT_ANALYSIS_DEMO=false
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=/app/.data/uploads
```

正式 Compose **不會**在 YAML 中寫死資料庫密碼；`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`、`DATABASE_URL` 皆由 `.env` 讀入。請將 `NEXTAUTH_URL`／`AUTH_URL` 設為**瀏覽器實際使用的公開 HTTPS origin**。

### 4. 啟動正式 Compose

```bash
docker compose -f docker-compose.prod.example.yml up -d --build
docker compose -f docker-compose.prod.example.yml ps
docker compose -f docker-compose.prod.example.yml logs -f web
```

應用程式在主機 loopback 的 `3000` 埠監聽（`127.0.0.1:3000`），供本機反向代理轉發。Postgres **不**對外公開。

### 5. 建立第一個管理員（`npm run db:seed-admin`）

正式映像已包含 `scripts/seed-admin.cjs`、`scripts/seed-admin-guard.cjs` 與執行所需的 `bcryptjs`／Prisma client。在 **Compose 已啟動且 Postgres 不對外公開** 的情況下，請在 `web` 容器內建立第一個真實管理員（**請勿使用 `@example.com` 電郵**）：

```bash
docker compose -f docker-compose.prod.example.yml exec \
  -e MARKINSIGHT_SEED_ADMIN_EMAIL='you@school.edu.hk' \
  -e MARKINSIGHT_SEED_ADMIN_PASSWORD='your-strong-password-here' \
  web npm run db:seed-admin
```

等價指令：

```bash
docker compose -f docker-compose.prod.example.yml exec \
  -e MARKINSIGHT_SEED_ADMIN_EMAIL='you@school.edu.hk' \
  -e MARKINSIGHT_SEED_ADMIN_PASSWORD='your-strong-password-here' \
  web node scripts/seed-admin.cjs
```

**示範身分拒絕：** `seed-admin` 會在連線資料庫**之前**拒絕任何以 `@example.com` 結尾的電郵（大小寫不拘），以及示範帳戶身分（`admin@example.com`／`teacher@example.com`／`student@example.com`／`demo_admin`／`demo_teacher`／`demo_student`），並以非零狀態結束，顯示：

> 此電郵屬於示範帳戶用途，不能作為正式管理員。請改用學校的真實電郵地址。

可選同步建立／重設教師（會覆寫該教師的 `passwordHash`；教師電郵同樣受上述示範身分檢查）：

```bash
docker compose -f docker-compose.prod.example.yml exec \
  -e MARKINSIGHT_SEED_ADMIN_EMAIL='you@school.edu.hk' \
  -e MARKINSIGHT_SEED_ADMIN_PASSWORD='your-strong-password-here' \
  -e MARKINSIGHT_SEED_TEACHER_EMAIL='teacher@school.edu.hk' \
  -e MARKINSIGHT_SEED_TEACHER_PASSWORD='another-strong-password' \
  -e MARKINSIGHT_SEED_SCHOOL_ID='your_school_id' \
  -e MARKINSIGHT_SEED_SCHOOL_NAME='Your School Name' \
  web npm run db:seed-admin
```

`MARKINSIGHT_SEED_SCHOOL_NAME` 只在 `MARKINSIGHT_SEED_SCHOOL_ID` 不是 `demo_school` 時生效；未設定時學校顯示名稱為 `School`。`demo_school` 會固定顯示為 `Demo School`。

容器已帶有指向 Compose 服務 `db` 的 `DATABASE_URL`，因此 **不必** 對外開放 5432。若主機另有 Node.js，亦可在能連到 `db` 的環境執行 `npm run db:seed-admin`（須自行設定正確的 `DATABASE_URL`）。

### 6. HTTPS 反向代理

在同一台主機安裝 Caddy 或 nginx，終止 TLS 後轉發到 `127.0.0.1:3000`。公開站台**必須**走 HTTPS（見上文：新建教師的臨時密碼會出現在 JSON 回應中）。

**Caddy 最小示例**（`/etc/caddy/Caddyfile`）：

```caddy
markinsight.example.com {
        reverse_proxy 127.0.0.1:3000
}
```

Caddy 會自動申請與更新憑證。使用 nginx 時，請設定 `proxy_pass http://127.0.0.1:3000;`，並自行配置 Let’s Encrypt（例如 certbot）。完成後確認 `.env` 內：

```bash
NEXTAUTH_URL=https://markinsight.example.com
AUTH_URL=https://markinsight.example.com
```

然後重建 web 容器使環境變數生效：

```bash
docker compose -f docker-compose.prod.example.yml up -d --force-recreate web
```

### 7. 防火牆

- **開放** TCP `80` 與 `443`（供 HTTPS／憑證）。
- **不要**對外開放 Postgres（`5432`）。正式 Compose 範例亦未發布該埠。
- 應用程式的 `3000` 僅綁定 `127.0.0.1`；一般情況下無需對公網開放 `3000`。

### 8. 命名 volume 在主機上的位置與備份

正式 Compose 使用命名 volume `markinsight_pg`（資料庫）與 `markinsight_uploads`（上載）。專案名固定為 `markinsight`，因此 Docker 完整名稱通常為 `markinsight_markinsight_pg` 與 `markinsight_markinsight_uploads`。

命名 volume **不是**專案目錄下的一般資料夾；實際資料位於 Docker 管理的主機路徑。請用下列指令查看：

```bash
docker volume ls | grep markinsight

docker volume inspect markinsight_markinsight_pg
docker volume inspect markinsight_markinsight_uploads
```

`docker volume inspect` 輸出中的 `Mountpoint`（常見於 Linux 為 `/var/lib/docker/volumes/<volume-name>/_data`）即為該 volume 在主機上的目錄。備份時可直接對該路徑打包，或使用下列容器方式（無需手動進入 Mountpoint）：

```bash
mkdir -p backups

# 備份 Postgres 資料目錄
docker run --rm \
  -v markinsight_markinsight_pg:/data:ro \
  -v "$(pwd)/backups:/backups" \
  alpine tar czf /backups/pg-$(date +%Y-%m-%d).tar.gz -C /data .

# 備份上載檔
docker run --rm \
  -v markinsight_markinsight_uploads:/data:ro \
  -v "$(pwd)/backups:/backups" \
  alpine tar czf /backups/uploads-$(date +%Y-%m-%d).tar.gz -C /data .
```

若你覆寫了專案名，請以 `docker volume ls`／`inspect` 顯示的完整名稱為準。亦可在資料庫容器內使用 `pg_dump`（將 `YOUR_USER`／`YOUR_DB` 換成 `.env` 中的 `POSTGRES_USER`／`POSTGRES_DB`）：

```bash
docker compose -f docker-compose.prod.example.yml exec -T db \
  pg_dump -U YOUR_USER YOUR_DB > "backups/markinsight-$(date +%Y-%m-%d).sql"
```

### 9. 升級程序

```bash
cd MarkInsight
git pull
docker compose -f docker-compose.prod.example.yml up -d --build
```

`entrypoint` 會在啟動時執行 `prisma db push`。升級後請做下方「持久化驗證」。**不要**在升級時加入第二個 web 副本。

### 10. 持久化驗證

1. 以管理員或教師身分上載一份檔案（試卷或答卷）。
2. 執行 `docker compose -f docker-compose.prod.example.yml up -d --build`（或 `--force-recreate web`）重新部署。
3. 確認該檔案仍可開啟。若檔案消失，代表上載 volume 未正確掛載，須修復後再上線。

---

## 更改管理員／教師密碼

### 已知缺口（本階段不做）

- **沒有**使用者自助更改密碼
- **沒有**管理後台「重新產生臨時密碼」按鈕
- **沒有**管理後台「刪除教師」功能；請勿依賴「刪除後再建立」作為改密途徑

管理後台「建立教師」會產生**隨機臨時密碼**（≥16 字元），**只在建立當下的回應／畫面顯示一次**。明文不會寫入 log，也不會再出現在教師列表。公開站台必須以 HTTPS 提供，以免該 JSON 回應中的臨時密碼被竊聽。

### 若管理員沒有複製該一次性臨時密碼

請用下列方式**重設該教師密碼**（idempotent，會覆寫 `passwordHash`）：

1. **以 seed 腳本重設**（見上文「建立第一個管理員」的 `docker compose … exec … npm run db:seed-admin`，並設定該教師的 `MARKINSIGHT_SEED_TEACHER_EMAIL`／`MARKINSIGHT_SEED_TEACHER_PASSWORD`／學校相關變數）。
2. **或以 SQL／操作程序直接更新** `User.passwordHash`（須自行以 bcrypt 產生雜湊；執行前請備份）。

管理員本人改密：同樣用 seed，只設 `MARKINSIGHT_SEED_ADMIN_*` 即可。腳本**不會**把密碼印到 log。

**注意：** 第一個真實管理員（以及之後的正式帳戶）**請勿使用 `@example.com` 電郵**。示範登入關閉時，系統會拒絕 `admin@example.com`／`teacher@example.com`／`student@example.com`，以及 id 為 `demo_admin`／`demo_teacher`／`demo_student` 的帳戶，即使資料庫仍留有舊的 `passwordHash`。

---

## 試用規則（資料安全）

- 只用**示範資料**或已**去識別**的試卷／答卷。
- **不要**上載真實學生答卷、真實姓名或其他可識別個人資料。
- 在任何教師開始使用之前：操作者必須先用一份**去識別**試卷跑通一次真實 OpenRouter 分析，確認逾時行為與結果質素。在此之前，公開 URL **只供操作者本人**使用。

---

## (d) Go-live 檢查清單

1. **硬性約束**
   - [ ] Web 僅單一實例（無 `deploy.replicas`、無水平擴充）
   - [ ] 上載使用命名 volume（`markinsight_uploads` 或等效命名 volume），掛載於 `STORAGE_LOCAL_DIR`；未改成匿名 volume
   - [ ] 公開站台使用 HTTPS（新建教師臨時密碼會出現在 JSON 回應中）

2. **密鑰與 URL**
   - [ ] `NEXTAUTH_SECRET`／`AUTH_SECRET` 已用 `openssl rand -base64 32` 產生
   - [ ] `NEXTAUTH_URL`／`AUTH_URL` 為公開 HTTPS origin（例如 `https://markinsight.example.com`），與瀏覽器網址一致
   - [ ] `.env` 已設定 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`、`DATABASE_URL`，且四者一致（`DATABASE_URL` 主機為 `db`）
   - [ ] `OPENROUTER_API_KEY` 已設定；`MARKINSIGHT_ANALYSIS_DEMO` 為 `false` 或未設定
   - [ ] 未設定弱的 `MARKINSIGHT_DEMO_PASSWORD`；若不需要示範帳戶則保持未設定

3. **儲存與資料庫**
   - [ ] `STORAGE_LOCAL_DIR` 在持久化命名 volume 上（可用 `docker volume inspect` 確認 `Mountpoint`）
   - [ ] Postgres 資料亦在持久化命名 volume（正式 Compose：`markinsight_pg`）
   - [ ] 防火牆開放 80／443；未對外開放 5432

4. **建立第一個真實管理員（不要用示範帳戶）**

   使用上文「Any Linux VPS」第 5 步，在 `web` 容器內執行 `npm run db:seed-admin`。
   - [ ] 管理員電郵**不是** `@example.com`（`seed-admin` 會拒絕示範電郵／身分並顯示上述錯誤；正式環境亦會拒絕示範身分登入）
   - [ ] 已用 seed 建立真實管理員，並以該帳戶登入成功

5. **【必須】若此資料庫曾經跑過本地 demo：刪除或重設示範帳戶**

   本地 bootstrap 可能留下 id `demo_admin`／`demo_teacher`／`demo_student`，或電郵 `admin@example.com`／`teacher@example.com`／`student@example.com`。若不清理，舊的示範 `passwordHash` 會繼續留在資料庫內，日後一旦誤開示範模式就可能再次暴露。

   **程式防護：** 當示範登入政策關閉時（正式環境預設），`authorizeCredentials` 會拒絕上述示範電郵與示範 id，**即使**資料庫列仍有 `passwordHash`。真實帳戶（其他電郵）不受影響。另外，`seed-admin` 會拒絕 `@example.com` 與示範身分（見上文「建立第一個管理員」），錯誤訊息為：「此電郵屬於示範帳戶用途，不能作為正式管理員。請改用學校的真實電郵地址。」

   仍強烈建議清除或重設這些示範列（或使用全新資料庫），以免日後誤開示範模式時再次暴露：

   - [ ] **已刪除或重設**上述示範帳戶（或改用全新資料庫——**強烈建議**正式環境用全新 Postgres volume）；刪除後以 `admin@example.com`／`password` 登入**必須失敗**
   - [ ] 第一個真實管理員電郵**不是** `@example.com`（`seed-admin` 會拒絕並顯示上述錯誤）

   **資料庫名稱：** 正式 Compose（`docker-compose.prod.example.yml`）的 Postgres 服務名為 `db`；資料庫名稱為 `.env` 中的 **`POSTGRES_DB`**（與 `POSTGRES_USER`／`POSTGRES_PASSWORD`／`DATABASE_URL` 必須一致）。本地示範 Compose（`docker-compose.yml`）預設資料庫名稱為 **`markinsight`**（使用者／密碼同為 `markinsight`）。正式環境請改用你自己設定的 `POSTGRES_*`，**不要**沿用示範密碼。

   **優先：全新資料庫**（Compose 範例：`docker compose -f docker-compose.prod.example.yml down -v` 後再 `up`，會清掉 DB 與上載 volume——只在確定可丟資料時使用）。

   **可選 SQL**（外鍵可能連帶刪除 enrollment／相關列；執行前請備份。表名以 Prisma 預設為準）。在已啟動的正式 Compose 環境，對服務 `db`、資料庫 `$POSTGRES_DB` 執行：

   ```bash
   docker compose -f docker-compose.prod.example.yml exec db \
     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
   ```

   （若 shell 未載入 `.env`，請把 `$POSTGRES_USER`／`$POSTGRES_DB` 換成你實際設定的值，例如使用者 `markinsight`、資料庫 `markinsight`。）

   進入 `psql` 後執行：

   ```sql
   DELETE FROM "User"
   WHERE id IN ('demo_admin', 'demo_teacher', 'demo_student')
      OR email IN (
        'admin@example.com',
        'teacher@example.com',
        'student@example.com'
      )
      OR email LIKE '%@example.com';
   ```

   **驗證：** 清理完成後，以 `admin@example.com`／`password`（或其他示範帳戶）登入**必須失敗**。

6. **持久化驗證**
   - [ ] 上載一份檔案 → 重新部署／重建 web 容器 → 該檔仍可開啟（確認命名 volume 生效）

7. **試用／上線閘門**
   - [ ] 只使用示範或去識別資料（見上文「試用規則」）
   - [ ] 操作者已用去識別試卷完成一次真實 OpenRouter 分析（逾時與質素 OK）後，才讓教師使用；在此之前 URL 僅供操作者

8. **煙霧驗證**
   - [ ] 開啟登入頁：不應出現示範帳戶區塊或字面 `password` 提示
   - [ ] 以 seed 管理員登入成功；以 `admin@example.com`／`password` 必須失敗
   - [ ] 管理後台新建教師：畫面顯示一次性臨時密碼（可複製），其後列表不再顯示明文
   - [ ] 教師開卷 → 上載 → 結構分析；學生上載答卷 → 評分（需有效 OpenRouter）

---

## 本地示範（筆電／Compose）

本地示範繼續使用根目錄的 `docker-compose.yml`（行為不變）。`.env.example` 預設 `MARKINSIGHT_ANALYSIS_DEMO=false`。本地要還原舊示範行為時，**必須手動**設為 `true`：

1. `.env` 中 `MARKINSIGHT_ANALYSIS_DEMO=true`
2. **不要**設定 `MARKINSIGHT_DEMO_PASSWORD`（或從 `.env` 移除）
3. 登入頁顯示示範帳戶，密碼提示為 `password`
4. `admin@example.com`／`teacher@example.com`／`student@example.com` 皆可以 `password` 登入

```bash
docker compose up --build -d
```

正式部署務必使用 `docker-compose.prod.example.yml`，並保持 `MARKINSIGHT_ANALYSIS_DEMO=false` 或未設定。

---

## 附錄：Coolify／其他 PaaS

若你選擇 Coolify、Railway、Fly.io、Render 或其他平台，請仍遵守同一套約束，而非依賴本倉庫的平台專屬設定：

- 建置並執行本倉庫的 **Dockerfile** 映像。
- 注入與上文相同的環境變數（尤其是 `NEXTAUTH_URL`／`AUTH_URL` 的 HTTPS origin、密鑰、`OPENROUTER_API_KEY`、`MARKINSIGHT_ANALYSIS_DEMO=false`，以及一致的 `POSTGRES_*`／`DATABASE_URL`）。
- **只跑一個 web 實例**（分析工作在行程內執行）。
- 為 `STORAGE_LOCAL_DIR` 掛載**持久化 volume**；Postgres 亦須持久化。
- 前面放置 HTTPS 反向代理（許多 PaaS 內建），並將公開 origin 寫入 `NEXTAUTH_URL`。

平台僅負責排程與網路；應用程式的單實例、HTTPS 與命名 volume 要求不會因平台而改變。

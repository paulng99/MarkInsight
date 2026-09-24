# eCircular（cccmmwc_edb_circulars）套用 MarkInsight UI/UX — 交付補丁

這個資料夾是一次性的交付物：把 MarkInsight 的設計系統完整套用到
`paulng99/cccmmwc_edb_circulars` 的 `apps/web`（Next.js）。

Cloud Agent 的 GitHub token 只有 MarkInsight 倉庫的寫入權限，無法直接
push 到 eCircular，所以改以 `git format-patch` 補丁系列交付（保留原本兩個 commit）。
套用完成後可整個刪除此資料夾。

## 套用步驟

```bash
git clone https://github.com/paulng99/cccmmwc_edb_circulars.git
cd cccmmwc_edb_circulars
git checkout -b feat/markinsight-ui main

BASE=https://raw.githubusercontent.com/paulng99/MarkInsight/cursor/ecircular-ui-handoff-e913/docs/handoff/ecircular-markinsight-ui
curl -fsSLO "$BASE/0001-feat-web-adopt-MarkInsight-design-system-across-the-.patch"
curl -fsSLO "$BASE/0002-fix-web-keep-settings-drawer-fixed-to-viewport-after.patch"
git am 000*.patch
rm 000*.patch

cd apps/web
npm ci
npm run build   # 已驗證：tsc / eslint / next build 全部通過
```

PowerShell 請逐行執行（不要用 `&&`）。

補丁基於 eCircular `main` 的 `bd5569d`（feat(localization): update English and
Chinese translations…）。若 `main` 之後有新 commit 而 `git am` 發生衝突，可改用
`git am -3` 做三方合併。

## 變更摘要（15 個檔案）

- `apps/web/src/app/globals.css` — 以 MarkInsight design tokens 重寫：
  藍色主色（`--brand #1a5fbf` / `--brand-deep` / `--brand-soft`）、`--ink` / `--muted` /
  `--border #c9d7e8`、語意色（success / warn / error / info）、動效 token（150 / 200 / 300 / 500ms）、
  `hero-grid`、`fade-up`、`success-pop`、`job-pulse`、`prefers-reduced-motion`。保留原有 class 名稱，
  元件外觀全部改為白底卡片＋淺邊框、實色藍按鈕、外框次要按鈕。
- `apps/web/src/app/[locale]/layout.tsx` — 以 `next/font` 載入 Noto Sans HK（內文）與 Source Serif 4（標題）。
- `apps/web/src/components/AppShell.tsx` — MarkInsight 頁首：襯線品牌名＋灰色分頁名、`繁 | EN`
  語言切換、文字式登出。
- `apps/web/src/components/LocaleSwitch.tsx`（新增）— `繁 | EN` 切換元件。
- `apps/web/src/components/StatusBadge.tsx`（新增）— 語意狀態徽章，執行中會脈動。
- `apps/web/src/app/[locale]/page.tsx` — 首頁改為 MarkInsight 風格 hero（未登入時），已登入自動導向文件頁。
- `apps/web/src/app/[locale]/login/page.tsx` — 淺色置中登入頁。
- `apps/web/src/app/[locale]/documents/page.tsx` — 主題標籤依主題著色（hue chips）、錯誤／空狀態樣式。
- `apps/web/src/app/[locale]/documents/[id]/page.tsx` — 狀態徽章、notice 樣式、預覽區塊。
- `apps/web/src/app/[locale]/chat/page.tsx` — 小幅 class 調整。
- `apps/web/src/app/[locale]/status/page.tsx` — 統計卡分色、執行狀態徽章、事件記錄區塊。
- `apps/web/src/app/[locale]/settings/page.tsx`、`apps/web/src/components/SourcesSection.tsx` —
  移除 inline style，改用新樣式類別；來源抽屜修正為固定於視窗。
- `apps/web/messages/en.json`、`apps/web/messages/zh-HK.json` — 新增 `home.*` 與狀態文字 key（只新增）。

日期格式維持 `yyyy-mm-dd`；i18n 維持 zh-HK / en。

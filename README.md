# 名古屋慢旅手帳

以附件 V1.2 規格及原始 JSON 建立的手機旅行 PWA。使用 Vite、React、TypeScript 與原創 SVG 插畫。主要針對 360～430px 手機設計，也支援桌面。

## 使用方式

部署後，任何知道網址的人都可直接使用，不需註冊登入。五個主分頁為首頁、行程、地圖、美食及旅程；另有景點詳情、收藏及參考資料頁。

- 六日行程、去回航班、飯店地址與導航，皆來自 `src/data/nagoya_trip_v1_2_seed.json`。
- 日期依 `Asia/Tokyo` 判斷；航班時間保留各機場當地時間。
- 收藏、行程完成、吃過、走訪、可編輯清單和地點筆記保存在各自瀏覽器的 `localStorage`，前綴為 `nagoya-v1.2:`。不同人的紀錄不會互相影響，也不會跨裝置同步。清除站點資料即重設。
- 飯店提供原始 Google Maps 連結；沒有核實座標的地方提供搜尋，不繪製假地圖標記、不計算距離或 ETA。
- 吉卜力時段已確認，票券持有狀態未確認；餐廳訂位狀態未確認。
- 地圖、影片及其他外部參考資料需要網路，連結可能隨來源更新或失效。
- 沒有即時航班、天氣、班次、GPS 定位、雲端同步、QR Code 儲存或餐廳訂位功能。

## 本機開發

需要 Node.js 24 及 npm；已提供 lockfile 與 `.nvmrc`。不需要 API 金鑰、資料庫或其他服務。

```sh
cd /workspace/-
npm ci
npm run dev -- --port 5173 --strictPort
```

`.npmrc` 將 npm 快取放在可寫的 `/tmp/nagoya-npm-cache`，避免雲端機器的唯讀使用者目錄造成安裝失敗。這個設定不影響網站執行。

## 建置與驗證

```sh
npm run build
npm test
```

`build` 包含 TypeScript 檢查及正式版建置，輸出到 `dist/`。`npm test` 使用 Playwright 自動啟動正式版預覽，驗證內容、互動、手機寬度、離線及 WCAG AA 自動檢查。測試優先使用 `/usr/bin/chromium`；其他機器先執行 `npx playwright install chromium`，或設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`。

也可執行 `npm run preview -- --port 4173 --strictPort` 查看正式版。驗證記錄見 `docs/validation.md`；原規格見 `docs/specification-v1.2.md`。

## 公開部署

這是純靜態網站，**啟動開發伺服器或發布 Codex 環境不等於網站已公開上線**。必須部署至提供 HTTPS 的網站主機後，才能取得任何人可用的網址。不需啟用登入、密碼或訪客驗證。

### Netlify / Cloudflare Pages / 其他靜態主機

1. 執行 `npm ci && npm run build`。
2. 將 **`dist` 內全部內容**上傳為網站根目錄，不要再包一層 `dist/`。也可將根目錄版本的部署 ZIP 解壓後上傳。
3. 設定 SPA fallback：所有非靜態檔案路由回傳 `/index.html`。建置已產生 Netlify/Cloudflare 相容的 `_redirects`。
4. 取得主機提供的 HTTPS 網址，於手機驗證首頁、`/itinerary/2026-11-02`、`/place/vessel-inn` 可直接開啟與重整後再分享。

### 此儲存庫的 GitHub Pages

已提供 `.github/workflows/deploy.yml`：`main` 有推送時，自動以 `SITE_BASE=/-/` 建置並部署。儲存庫 Settings → Pages → Build and deployment 的 Source 需選 **GitHub Actions**。私人儲存庫的 Pages 可用性取決於帳號方案。

手動測試 Pages 的子目錄建置：

```sh
SITE_BASE=/-/ npm run build
npm run preview -- --port 4173 --strictPort
```

Pages 預定路徑為 `https://cowboywowo-bot.github.io/-/`，**這是預定部署位置，是否已上線須以實際部署成功與 HTTPS 檢查為準**。靜態 404 會保留目標路徑並返回應用程式，因此直接開啟詳頁也能還原正確內容。若改到其他子目錄，必須同步調整 `SITE_BASE`。其他主機以根目錄部署時不用設定此變數。

GitHub API 操作需要環境允許 `api.github.com`，Git 推送需要此儲存庫的寫入權限；不要將金鑰或 token 寫入程式或 JSON。

## 加入主畫面與離線

- iPhone：使用 Safari 開啟 HTTPS 網址，分享 → 加入主畫面。
- Android：使用 Chrome 選單的安裝／新增至主畫面。
- 首次連網載入且 Service Worker 完成快取後，App、六日行程與飯店地址可離線閱讀。畫面底部會顯示是否已完成快取。安裝及離線支援依瀏覽器而異。
- 有新版本時顯示「立即更新」，避免未確認就中斷使用中的手帳。
- 地圖、影片、外部網頁及即時資料沒有離線支援。

## 資料與隱私

此網站可公開存取，行程 JSON 屬公開網站內容，請勿加入護照號碼、票券 QR、訂房代碼或信用卡資料。網站沒有登入、追蹤程式、分析服務或後端；筆記也請避免填寫敏感個資。

首頁主圖使用使用者提供的 `src/assets/nagoya-people.png`，保留原始圖片內容與比例，標題放在上方天空區域。其餘原創插畫位於 `src/Landscape.tsx`、`src/main.tsx` 的料理插畫及 `public/icons/`。字體使用裝置既有字體，不需外部字體服務。

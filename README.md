# Aquarise 保費融資計算機

這是一個以 Traditional Chinese 顯示的保費融資情境試算工具，採用 Aquarise「流水」主題重新編排主要試算流程。深水視覺會以本地 WebGL1 紋理呈現短暫指標漣漪，游標、年份滑桿及息率情境會連動實際投影資料；不支援 WebGL 或啟用 reduced motion 時仍保留清晰的靜態水面圖片。

原有 USD/HKD、逐年息率、固定年利率、IRR、儲存和 CSV 匯出流程保留。主要頁面只提供檢視年份，並不會改變投射年期；完整假設、逐年表格、舊版堆疊圖及現金流表可由頁面下方展開。

## 本機使用

這個版本沒有 npm 或框架依賴。由靜態伺服器開啟 `index.html` 即可：

```text
index.html
deep-flow.css
deep-flow.js
assets/vendor/gsap/gsap.min.js
assets/vendor/canvas-ui/RippleVanilla.js
ui-enhancements.js
assets/deep-flow-water.webp
assets/deep-flow-report-water.webp
```

所有 script、source map 和圖片都使用相對路徑，適用於根路徑或 GitHub Pages 的 `/P-fin/` 子路徑。

## 動效與漸進增強

- GSAP 3.15.0 只負責結果更新後約 200ms 的視覺提示，不會補間任何財務數值，也沒有頁面載入動畫。
- 深水區以本地 `deep-flow-water.webp` 為底，WebGL1 只在指標移動或點擊後短暫啟動漣漪，約 1.45 秒後停止；畫布採用 `object-fit: cover` 同比例裁切，圖表和文字始終由 DOM/2D canvas 置於水面上方。
- `deep-flow.js` 透過 `aquarise:render` 事件讀取原有 `calculateProjection()` 結果，未複製財務公式；右側數值使用原有顯示轉換，所以 HKD 保單匯率和融資額匯率仍然分開處理。
- `prefers-reduced-motion: reduce` 會停用結果提示和 Ripple。
- Canvas UI Ripple 只用於品牌標誌的刻意點擊互動，`interval: 0`，不會在財務數字後方持續運行。
- Ripple 需要 `layoutsubtree`、`drawElementImage`、`requestPaint`、WebGL2、`ResizeObserver` 和 `IntersectionObserver`；不符合條件時保留普通標誌和 CSS 水波 fallback。沒有加入 browser flag、origin trial 或網路 runtime 依賴。
- 頁面隱藏或離開時會釋放 Ripple 資源。

## 本地字型與圖示

- `assets/fonts/noto-serif-tc-ui.woff2` 來自 Google Fonts 的 Noto Serif TC 介面文字子集，授權資料見 `assets/fonts/OFL.txt`。
- `assets/icons/` 保存 Phosphor Icons regular SVG 及 MIT 授權副本；圖示以外部 SVG 資產載入，沒有在頁面內手繪圖示路徑。

## 第三方來源

### GSAP

本專案內的 `assets/vendor/gsap/` 是 GSAP 3.15.0 的已驗證瀏覽器發佈檔副本，保留檔案內嵌授權標頭及 source map。

- npm 套件來源：https://www.npmjs.com/package/gsap
- 官方安裝文件：https://gsap.com/docs/v3/Installation/
- Standard License：https://gsap.com/standard-license/

### Canvas UI Ripple (Vanilla)

- 官方 registry：https://canvasui.dev/r/ripple-vanilla.json
- 官方元件頁：https://canvasui.dev/docs/components/ripple
- 原始碼保存於 `assets/vendor/canvas-ui/RippleVanilla.ts`
- `RippleVanilla.js` 由 Node.js 24 的 `node:module.stripTypeScriptTypes` 產生，只移除 TypeScript 型別並保留 `supportsHtmlInCanvas`、`createRipple` exports。
- 授權副本：https://github.com/DavidHDev/canvas-ui/blob/main/LICENSE.md

Ripple 的 MIT + Commons Clause 條款請一併參閱 `assets/vendor/canvas-ui/LICENSE.md`。本專案未把元件另行包裝成獨立套件。

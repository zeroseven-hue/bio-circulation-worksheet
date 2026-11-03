# 國中生物 4-2 內分泌系統 數位互動學習單

專為國中 7 年級生物課堂量身打造的**「4-2 內分泌系統數位互動學習單」**，融合教學鷹架、課堂分組防呆機制與科技藍調（HUD Tech Blue）視覺設計，全面支援 iPad / Chromebook 觸控操作與離線/弱網環境防護。

---

## 🌐 線上發布網址 (GitHub Pages)

- **學生線上作答入口**：[https://zeroseven-hue.github.io/bio-endocrine-worksheet/](https://zeroseven-hue.github.io/bio-endocrine-worksheet/)
- **GitHub 倉儲**：[https://github.com/zeroseven-hue/bio-endocrine-worksheet](https://github.com/zeroseven-hue/bio-endocrine-worksheet)

---

## 📁 檔案架構

| 檔案名稱 | 核心職責說明 |
| :--- | :--- |
| [`index.html`](index.html) | 前端語意化架構：頂部身分設定、個人 7 關卡 Stepper、小組 SVG 人體圖互動與結算 Modal |
| [`style.css`](style.css) | 科技藍調（深藍/靛藍/冰藍）視覺風格、教室日光燈抗眩光高對比白底卡片、44px 觸控熱區與光暈動態 |
| [`game.js`](game.js) | 核心邏輯：701~710/01~35 純數字選單、小組每人認領防呆、`localStorage` 本地自動暫存、8秒防塞車降級與 GAS 傳送 |
| [`Code.gs`](Code.gs) | 後端 Google Apps Script 核心：支援個人/小組分頁分流、客觀題自動批改統計、素養簡答待閱、**就地更新（In-Place Update）** |

---

## 🚀 教師部署與 GAS 串接指南 (3 步驟)

1. **建立 Google 試算表**：
   - 開啟 [Google 雲端硬碟](https://drive.google.com/) 建立一份全新的 Google 試算表（命名如：`7年級_4-2內分泌學習單成績紀錄`）。
2. **貼上 Apps Script 程式碼**：
   - 點選上方選單 **「擴充功能」 ➜ 「Apps Script」**。
   - 將本專案中的 [`Code.gs`](Code.gs) 內容完整複製並貼入編輯器中儲存。
3. **發布為 Web 應用程式**：
   - 點選右上角 **「部署」 ➜ 「新增部署作業」**。
   - 種類選擇 **「網頁應用程式 (Web app)」**。
   - 執行身分選擇：**「我 (Your Google Account)」**。
   - 存取權限選擇：**「所有人 (Anyone)」**（**關鍵步驟！**）。
   - 點選「部署」後，複製產生的網頁應用程式網址（`/exec` 結尾）。
   - 將該網址貼入 [`game.js`](game.js) 第 7 行的 `const GAS_URL = "YOUR_GAS_EXEC_URL";` 中並 Git Push 即可！

---

## 💡 課堂特色與防呆亮點

1. **個人速記模式（關卡式 Stepper）**：
   - 7 大關卡步驟導航，即時以綠色 Check 標註完成狀態，支援雙向跳轉與回填。
   - 包含多選核取方塊、結構化配對、公分單位鎖定與素養同理心簡答句型鷹架。
2. **小組統整模式（人體腺體圖互動）**：
   - 純向量 SVG 人體呼吸光點 A~F 點擊連動右側任務卡。
   - 支援 3~6 人彈性分組，每題強制指定負責組員，**防呆驗證「全組每人皆至少認領一題」**。
3. **8 秒 Wi-Fi 塞車降級與離線保護**：
   - 全班 35 台平板同時送出時，若遇校園網路壅塞超過 8 秒，自動轉為快照保護，絕不卡死下課收機流程。
4. **平板交回 4 大自我檢核**：
   - 完賽彈窗整合「關靜音、清相簿、關分頁、插回充電車」課堂常規檢核。

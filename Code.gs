/**
 * ==========================================================================
 * 國中生物 數位互動學習單平台 (Bio Learning Sheets Hub)
 * 全站共用後端 API (GAS) - 支援多單元共用、雙向讀寫、出缺席同步、手動補登、防洗板就地更新
 * 
 * 🌟 包含自訂選單：【🧬 生物學習單工具】➜【✨ 一鍵美化所有工作表 (高雅科技藍調)】
 * ==========================================================================
 */

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || "getRecords";
    var sheetId = params.sheetId || params.unitId || params.weekId || "4-2";
    var classId = params.studentClass || "";

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 讀取指定單元學習單的繳交紀錄
    if (action === "getRecords") {
      var sheetName = "單元" + sheetId + "作答紀錄";
      var sheet = ss.getSheetByName(sheetName);
      
      // 相容舊命名格式
      if (!sheet) sheet = ss.getSheetByName("第" + sheetId + "週作答紀錄");
      if (!sheet) sheet = ss.getSheetByName("作答紀錄_" + sheetId);

      var records = [];

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getValues();
        // 表頭: [時間戳記, 班級, 座號, 姓名, 組別/模式, 系統初評分數, 評分明細, 作答詳情 (JSON)]
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var rowClass = String(row[1] || "").trim();
          if (!classId || rowClass === String(classId).trim()) {
            records.push({
              timestamp: row[0],
              studentClass: row[1],
              studentSeat: String(row[2]).padStart(2, '0'),
              studentName: row[3],
              studentGroup: row[4],
              score: row[5],
              scoreBreakdown: row[6],
              answers: row[7]
            });
          }
        }
      }

      // 同步讀取出缺席紀錄
      var attSheet = ss.getSheetByName("出缺席紀錄");
      var attendance = { absentSeats: [], expectedCount: 30 };
      if (attSheet && attSheet.getLastRow() > 1) {
        var attData = attSheet.getDataRange().getValues();
        for (var j = attData.length - 1; j >= 1; j--) {
          var aRow = attData[j];
          if (String(aRow[1]).trim() === String(classId).trim() && String(aRow[2]).trim() === String(sheetId).trim()) {
            attendance = {
              expectedCount: Number(aRow[3]) || 30,
              absentSeats: String(aRow[4] || "").split(',').map(function(s) { return s.trim(); }).filter(Boolean)
            };
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        sheetId: sheetId,
        studentClass: classId,
        records: records,
        attendance: attendance
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "國中生物數位學習單共用 API 運作正常",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "warning",
        message: "無有效 POST 資料"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetId = data.sheetId || data.unitId || data.weekId || "4-2";

    // 模式 A：教師儀表板一鍵儲存出缺席與請假座號
    if (data.action === "saveAttendance") {
      var attSheet = ss.getSheetByName("出缺席紀錄");
      if (!attSheet) {
        attSheet = ss.insertSheet("出缺席紀錄");
        attSheet.appendRow(["時間戳記", "班級", "單元編號", "實到應交人數", "請假座號名單", "未交座號名單", "備註"]);
        formatAttendanceSheet(attSheet);
      }

      attSheet.appendRow([
        new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        data.studentClass,
        sheetId,
        data.expectedCount,
        (data.absentSeats || []).join(", "),
        (data.unsubmittedSeats || []).join(", "),
        "由教師即時儀表板同步"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "出缺席紀錄已成功儲存至試算表【出缺席紀錄】分頁！"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 模式 B：學生送出作答 或 教師手動補登成績 (具備防洗板 In-Place 覆蓋更新)
    var sheetName = "單元" + sheetId + "作答紀錄";
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "時間戳記", 
        "班級", 
        "座號", 
        "姓名", 
        "組別/模式", 
        "系統初評分數", 
        "評分明細", 
        "作答詳情 (JSON 原始紀錄)"
      ]);
      formatBioSheet(sheet);
    }

    var targetSeat = String(data.studentSeat || data.seatOrGroup || "").padStart(2, '0');
    var targetClass = String(data.studentClass || data.class || "").trim();
    var existingRowIndex = -1;

    // 🔍 查重比對：相同班級、相同座號
    if (sheet.getLastRow() > 1) {
      var existingData = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues();
      for (var r = 0; r < existingData.length; r++) {
        if (String(existingData[r][0]).trim() === targetClass && String(existingData[r][1]).padStart(2, '0') === targetSeat) {
          existingRowIndex = r + 2;
          break;
        }
      }
    }

    var rowValues = [
      data.timestamp || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      targetClass,
      targetSeat,
      data.studentName || data.nameOrMembers || "未具名",
      data.studentGroup || data.mode || "個人速記",
      typeof data.score === 'number' ? data.score : (Number(data.score) || 0),
      Array.isArray(data.scoreBreakdown) ? data.scoreBreakdown.join("； ") : (data.scoreBreakdown || (data.essay ? "素養簡答: " + data.essay : "正常作答")),
      typeof data.answers === 'object' ? JSON.stringify(data.answers) : (typeof data.detailData === 'object' ? JSON.stringify(data.detailData) : (data.answers || "{}"))
    ];

    if (existingRowIndex > 0) {
      // 原地覆蓋更新，杜絕重複洗板
      sheet.getRange(existingRowIndex, 1, 1, 8).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    // 自然排序（依班級、座號升冪排序）
    var lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort([
        { column: 2, ascending: true },
        { column: 3, ascending: true }
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: existingRowIndex > 0 ? "已更新此座號之最新繳交紀錄！" : "資料已成功儲存至試算表！",
      recordedScore: data.score
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ==========================================================================
 * 🎨 試算表美化核心邏輯 (科技藍調 / 斑馬交替色彩 / 精準欄寬 / 凍結置中)
 * ==========================================================================
 */
function formatBioSheet(sheet) {
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var lastCol = 8;

  // 1. 凍結首列與表頭高度
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);

  // 2. 表頭文字與顏色 (科技深海藍 #1E3A8A)
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange
    .setBackground("#1E3A8A")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center");

  // 3. 欄位最佳化寬度
  sheet.setColumnWidth(1, 165); // 時間戳記
  sheet.setColumnWidth(2, 75);  // 班級
  sheet.setColumnWidth(3, 65);  // 座號
  sheet.setColumnWidth(4, 95);  // 姓名
  sheet.setColumnWidth(5, 115); // 組別/模式
  sheet.setColumnWidth(6, 115); // 初評分數
  sheet.setColumnWidth(7, 360); // 評分明細
  sheet.setColumnWidth(8, 160); // 作答詳情 (JSON)

  // 4. 資料列排版與垂直置中
  if (lastRow > 1) {
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setVerticalAlignment("middle").setFontSize(10);

    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center"); // 時間
    sheet.getRange(2, 2, lastRow - 1, 1).setHorizontalAlignment("center"); // 班級
    sheet.getRange(2, 3, lastRow - 1, 1).setHorizontalAlignment("center").setNumberFormat("@"); // 座號補零純文字
    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold"); // 姓名
    sheet.getRange(2, 5, lastRow - 1, 1).setHorizontalAlignment("center"); // 組別
    sheet.getRange(2, 6, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold"); // 分數
    sheet.getRange(2, 7, lastRow - 1, 1).setHorizontalAlignment("left");   // 明細
    sheet.getRange(2, 8, lastRow - 1, 1).setHorizontalAlignment("left");   // 作答詳情

    // 資料列高
    for (var r = 2; r <= Math.min(lastRow, 50); r++) {
      sheet.setRowHeight(r, 30);
    }
  }

  // 5. 套用斑馬條紋交替色彩 (白底 / 冰川淺藍 #F0F9FF)
  try {
    var bandings = sheet.getBandings();
    for (var b = 0; b < bandings.length; b++) {
      bandings[b].remove();
    }
    var fullRange = sheet.getRange(1, 1, Math.max(lastRow, 50), lastCol);
    fullRange.applyRowBanding()
      .setHeaderRowColor("#1E3A8A")
      .setFirstRowColor("#FFFFFF")
      .setSecondRowColor("#F0F9FF");
  } catch (bandErr) {}
}

/**
 * 美化出缺席紀錄表
 */
function formatAttendanceSheet(sheet) {
  if (!sheet) return;
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);
  var header = sheet.getRange(1, 1, 1, 7);
  header.setBackground("#0284C7").setFontColor("#FFFFFF").setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
  sheet.setColumnWidth(1, 165);
  sheet.setColumnWidth(2, 75);
  sheet.setColumnWidth(3, 85);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 150);
}

/**
 * ==========================================================================
 * 🚀 一鍵美化全試算表所有單元工作表 (點擊上方選單即可自動執行！)
 * ==========================================================================
 */
function formatAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var count = 0;

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var name = s.getName();
    if (name.indexOf("作答紀錄") !== -1) {
      if (s.getLastRow() > 2) {
        try {
          s.getRange(2, 1, s.getLastRow() - 1, 8).sort([
            { column: 2, ascending: true },
            { column: 3, ascending: true }
          ]);
        } catch(e) {}
      }
      formatBioSheet(s);
      count++;
    } else if (name === "出缺席紀錄") {
      formatAttendanceSheet(s);
    }
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("已成功套用生物科技藍調美化 " + count + " 個作答紀錄表！", "✨ 美化完成", 5);
  } catch(e) {}
}

/**
 * 試算表開啟時自動掛載自訂選單（就像行動方程式工具一樣！）
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧬 生物學習單工具')
    .addItem('✨ 一鍵美化所有工作表 (套用科技藍調樣式)', 'formatAllSheets')
    .addToUi();
}

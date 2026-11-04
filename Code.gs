/**
 * ==========================================================================
 * 國中生物 數位互動學習單平台 (Bio Learning Sheets Hub)
 * 全站共用後端 API (GAS) - 支援多單元共用、雙向讀寫、出缺席同步、手動補登、防洗板就地更新
 * ==========================================================================
 * 
 * 核心機制：
 * 1. 【通用性 (Multi-Sheet Universal)】：
 *    - 支援依 sheetId / unitId (例如 "4-2", "4-1", "4-3", "1", "2" 等) 自動分頁建立與存取！
 *    - 未來任何新生物學習單上線，完全共用同一個試算表與同一組 GAS 部署，無需每次重建！
 * 
 * 2. 【doGet 雙向讀取】：
 *    - action="getRecords": 儀表板查詢指定班級、指定單元之已繳交紀錄與即時成績。
 *    - 讀取對應出缺席紀錄（請假座號名單、應到人數）。
 * 
 * 3. 【doPost 雙向寫入與防洗板】：
 *    - action="saveAttendance": 教師儀表板一鍵同步出缺席紀錄至【出缺席紀錄】分頁。
 *    - 學生作答提交 / 教師手動補登：比對「班級 + 座號」，若已存在則自動【就地覆蓋更新】，杜絕重複洗板。
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
        attSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#0284c7").setFontColor("#FFFFFF");
        attSheet.setFrozenRows(1);
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
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1e3a8a").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    var targetSeat = String(data.studentSeat || data.seatOrGroup || "").padStart(2, '0');
    var targetClass = String(data.studentClass || data.class || "").trim();
    var existingRowIndex = -1;

    // 🔍 查重比對：相同班級、相同座號
    if (sheet.getLastRow() > 1) {
      var existingData = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues(); // 班級(欄2), 座號(欄3)
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
      // 重複繳交：原地更新覆蓋該行，維持乾淨整齊
      sheet.getRange(existingRowIndex, 1, 1, 8).setValues([rowValues]);
    } else {
      // 全新繳交：新增一列
      sheet.appendRow(rowValues);
    }

    // 自然排序（依座號升冪排序）
    var lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({ column: 3, ascending: true });
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

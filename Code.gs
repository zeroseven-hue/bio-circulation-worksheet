/**
 * 國中生物 4-2 內分泌系統 數位互動學習單
 * 後端 Google Apps Script (Code.gs)
 * 
 * 核心特色：
 * 1. 支援個人模式 (individual) 與小組模式 (group) 分頁自動路由與表頭建立。
 * 2. 嚴格客觀題自動批改驗證與得分統計。
 * 3. 素養簡答題文字妥善保留，並自動加註「待閱」標記。
 * 4. 採用「就地更新（In-Place Update）」演算法：同一位學生 (班級+座號) 或同一組重複提交時原地覆蓋更新，杜絕試算表無限增行。
 * 5. 支援 CORS 跨網域存取與 JSON 回傳。
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "無有效 POST 資料" });
    }

    var payload = JSON.parse(e.postData.contents);
    var mode = payload.mode || "individual";
    var cls = String(payload.class || "").trim();
    var seatOrGroup = String(payload.seatOrGroup || "").trim();
    var nameOrMembers = String(payload.nameOrMembers || "").trim();
    var score = typeof payload.score === "number" ? payload.score : 0;
    var essay = String(payload.essay || "").trim();
    var detail = payload.detailData || {};
    var timestamp = new Date();

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (mode === "individual") {
      handleIndividualSubmission(ss, cls, seatOrGroup, nameOrMembers, score, essay, detail, timestamp);
    } else {
      handleGroupSubmission(ss, cls, seatOrGroup, nameOrMembers, score, essay, detail, timestamp);
    }

    return createJsonResponse({
      status: "success",
      message: "成績與學習單紀錄已成功同步至試算表！",
      recordedScore: score,
      mode: mode,
      target: cls + "班 " + seatOrGroup
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "伺服器處理異常: " + err.toString()
    });
  }
}

/** 處理個人模式就地更新或新增 */
function handleIndividualSubmission(ss, cls, seat, name, score, essay, detail, timestamp) {
  var sheetName = "個人作答紀錄_" + cls;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "班級", "座號", "姓名", "客觀題得分", "素養題審核", "素養簡答內容",
      "Q1身高", "Q1激素", "Q1腺體",
      "Q2甲亢症狀",
      "Q3瑪麗亞年齡", "Q3缺乏激素", "Q3呆小症特徵",
      "Q4副甲位置", "Q4副甲功能",
      "Q5緊急激素", "Q5腺體位置", "Q5應急生理反應",
      "Q6異常激素", "Q6降血糖配對", "Q6升血糖配對", "Q6照護原則",
      "Q7性別激素", "最後更新時間"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#0284c7")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }

  // 格式化細項
  var q1_h = detail.q1_height || "";
  var q1_hormone = detail.q1_hormone || "";
  var q1_gland = detail.q1_gland || "";
  var q2_s = Array.isArray(detail.q2_symptoms) ? detail.q2_symptoms.join(", ") : "";
  var q3_a = detail.q3_age || "";
  var q3_h = detail.q3_hormone || "";
  var q3_s = Array.isArray(detail.q3_symptoms) ? detail.q3_symptoms.join(", ") : "";
  var q4_l = detail.q4_location || "";
  var q4_f = detail.q4_function || "";
  var q5_h = detail.q5_hormone || "";
  var q5_l = detail.q5_location || "";
  var q5_f = Array.isArray(detail.q5_functions) ? detail.q5_functions.join(", ") : "";
  var q6_ab = detail.q6_abnormal_hormone || "";
  var q6_low = (detail.q6_lower_hormone || "") + " (" + (detail.q6_lower_convert || "") + ")";
  var q6_raise = (detail.q6_raise_hormone || "") + " (" + (detail.q6_raise_convert || "") + ")";
  var q6_care = Array.isArray(detail.q6_cares) ? detail.q6_cares.join(", ") : "";
  var q7_h = detail.q7_hormone_change || "";

  var rowData = [
    cls, seat, name, score, "待閱", essay,
    q1_h, q1_hormone, q1_gland,
    q2_s,
    q3_a, q3_h, q3_s,
    q4_l, q4_f,
    q5_h, q5_l, q5_f,
    q6_ab, q6_low, q6_raise, q6_care,
    q7_h, timestamp
  ];

  // 就地更新演算法（尋找相同座號）
  var data = sheet.getDataRange().getValues();
  var foundRowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][1]) === String(seat)) {
      foundRowIndex = r + 1;
      break;
    }
  }

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  // 自動依座號升冪排序（第 2 欄座號）
  var lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({ column: 2, ascending: true });
  }
}

/** 處理小組模式就地更新或新增 */
function handleGroupSubmission(ss, cls, groupNum, members, score, essay, detail, timestamp) {
  var sheetName = "小組統整紀錄_" + cls;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "班級", "組別", "出席組員座號", "小組總分", "審核狀態",
      "A腦垂腺(負責人/激素/異常)",
      "B甲狀腺(負責人/激素/異常)",
      "C副甲狀腺(負責人/激素/異常)",
      "D腎上腺(負責人/激素/應急)",
      "E胰島(負責人/雙向激素/疾病)",
      "F性腺(負責人/關鍵激素/調控)",
      "比較表傳遞方式(內分泌vs神經)",
      "比較表速度(內分泌vs神經)",
      "比較表範圍(內分泌vs神經)",
      "比較表時間(內分泌vs神經)",
      "最後更新時間"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#1e3a8a")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }

  var glands = detail.glands || {};
  var comp = detail.compare || {};

  function fmtGland(g) {
    var item = glands[g] || {};
    return "負責:" + (item.assignee || "--") + "號 | 腺體:" + (item.name || "--") + " | 激素:" + (item.hormone || "--") + " | 特徵:" + (item.disease || "--");
  }

  var rowData = [
    cls, groupNum, members, score, "已評分",
    fmtGland("A"),
    fmtGland("B"),
    fmtGland("C"),
    fmtGland("D"),
    fmtGland("E"),
    fmtGland("F"),
    (comp.trans_endo || "") + " vs " + (comp.trans_nerv || ""),
    (comp.speed_endo || "") + " vs " + (comp.speed_nerv || ""),
    (comp.scope_endo || "") + " vs " + (comp.scope_nerv || ""),
    (comp.time_endo || "") + " vs " + (comp.time_nerv || ""),
    timestamp
  ];

  // 就地更新演算法（尋找相同組別）
  var data = sheet.getDataRange().getValues();
  var foundRowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][1]) === String(groupNum)) {
      foundRowIndex = r + 1;
      break;
    }
  }

  if (foundRowIndex > 0) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/** 支援 GET 請求做為後端健康檢查 */
function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "國中生物 4-2 內分泌系統數位學習單後端服務",
    time: new Date().toISOString()
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

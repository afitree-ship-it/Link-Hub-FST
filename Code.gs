var SPREADSHEET_ID = "1pphCw3O30znOqQeyAgYsv9P4M6SRVGFVdn_aDbDqwPY";
var SHEET_NAME = "Links";
var SETTINGS_SHEET_NAME = "Settings";
var ADMINS_SHEET_NAME = "Admins";

// 👉 ฟังก์ชันสำหรับรันครั้งแรกเพื่อสร้างชีตทั้งหมด (กด "เรียกใช้" ได้เลย)
function initialSetup() {
  var ss = getSS();
  
  // 1. ชีต Links
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "ID", "Title", "URL", "Description", "Target Audience", "Click Count", "Created At", "Thumbnail URL", "Is Pinned"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
  }

  // 2. ชีต Settings
  var settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    settingsSheet.appendRow(["Key", "Value"]);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#3B82F6").setFontColor("#FFFFFF");
    settingsSheet.appendRow(["siteTitle", "SciTech Link Portal"]);
    settingsSheet.appendRow(["siteLogoUrl", ""]);
    settingsSheet.appendRow(["announcementText", ""]);
    settingsSheet.appendRow(["isAnnouncementActive", "false"]);
    settingsSheet.appendRow(["staffPasswords", "[]"]);
    settingsSheet.appendRow(["staffPasswordItems", "[]"]);
  }

  // 3. ชีต Admins
  var adminsSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  if (!adminsSheet) {
    adminsSheet = ss.insertSheet(ADMINS_SHEET_NAME);
    adminsSheet.appendRow(["Username", "Password", "Role", "PinnedLinks"]);
    adminsSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#E11D48").setFontColor("#FFFFFF");
    adminsSheet.appendRow(["admin", "admin1234", "superadmin", "[]"]);
  }

  Logger.log("✅ สร้างชีตทั้งหมดสำเร็จ: Links, Settings, Admins");
}

function getSS() {
  try {
    return SPREADSHEET_ID === "YOUR_SPREADSHEET_ID_HERE" || !SPREADSHEET_ID ? SpreadsheetApp.getActiveSpreadsheet() : SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getSheet() {
  var ss = getSS();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "ID", "Title", "URL", "Description", "Target Audience", "Click Count", "Created At", "Thumbnail URL", "Is Pinned"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
  }
  return sheet;
}

function getSettingsSheet() {
  var ss = getSS();
  var sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    sheet.appendRow(["Key", "Value"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#3B82F6").setFontColor("#FFFFFF");
  }
  return sheet;
}

function getAdminsSheet() {
  var ss = getSS();
  var sheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ADMINS_SHEET_NAME);
    sheet.appendRow(["Username", "Password", "Role", "PinnedLinks"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#E11D48").setFontColor("#FFFFFF");
    sheet.appendRow(["admin", "admin1234", "superadmin", "[]"]);
  }
  return sheet;
}

// 📡 สำหรับดึงข้อมูลทั้งหมดผ่าน GET (Links + Settings)
function doGet(e) {
  var out = { success: false, error: "Unknown Action" };
  try {
    if (!e) {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "Please deploy as Web App and access via URL."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ดึงข้อมูล Links
    var sheet = getSheet();
    var rows = sheet.getDataRange().getValues();
    var results = [];
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (row[0]) {
        var rawAud = String(row[4] || "").trim().toLowerCase();
        var targetAudience = "both";
        if (rawAud === "staff" || rawAud === "yes" || rawAud === "true" || rawAud === "บุคลากร") {
          targetAudience = "staff";
        } else if (rawAud === "student" || rawAud === "นักศึกษา") {
          targetAudience = "student";
        } else {
          targetAudience = "both";
        }

        results.push({
          id: String(row[0]),
          title: String(row[1]),
          url: String(row[2]),
          description: String(row[3]),
          targetAudience: targetAudience,
          isStaffOnly: targetAudience === "staff",
          clickCount: parseInt(row[5] || "0", 10) || 0,
          createdAt: String(row[6]),
          thumbnailUrl: String(row[7]),
          isPinned: row[8] === "Yes" || row[8] === true
        });
      }
    }
    
    // ดึงข้อมูล Settings
    var settings = {};
    try {
      var settingsSheet = getSettingsSheet();
      var settingsRows = settingsSheet.getDataRange().getValues();
      for (var j = 1; j < settingsRows.length; j++) {
        var key = String(settingsRows[j][0]).trim();
        if (key && key !== "adminPassword") {
          settings[key] = String(settingsRows[j][1]);
        }
      }
    } catch (sErr) {}

    out = { success: true, data: results, settings: settings };
  } catch (err) {
    out = { success: false, error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// 📡 สำหรับบันทึก ซิงค์ข้อมูลทั้งหมดผ่าน POST
function doPost(e) {
  var out = { success: false, error: "Invalid Action" };
  var lock = null;
  try {
    if (!e || !e.postData) {
       return ContentService.createTextOutput(JSON.stringify({success: false, message: "No post data."}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var rawData = e.postData.contents;
    var postData = JSON.parse(rawData);
    var action = postData.action;

    // ล็อกไว้เพื่อไม่ให้คำขอที่เข้ามาพร้อมกันเขียนทับกัน
    lock = LockService.getScriptLock();
    lock.waitLock(20000);

    var sheet = getSheet();
    
    // 1. ซิงค์ข้อมูลทั้งหมด (ทั้ง Links และ Settings)
    if (action === "sync") {
      if (postData.links && Array.isArray(postData.links)) {
        var links = postData.links;
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
        }
        if (links.length > 0) {
          var rows = [];
          for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var audVal = link.targetAudience === "staff" ? "Staff" : (link.targetAudience === "student" ? "Student" : (link.isStaffOnly ? "Staff" : "Both"));
            rows.push([
              link.id || "",
              link.title || "",
              link.url || "",
              link.description || "",
              audVal,
              link.clickCount || 0,
              link.createdAt || "",
              link.thumbnailUrl || "",
              link.isPinned ? 'Yes' : 'No'
            ]);
          }
          sheet.getRange(2, 1, rows.length, 9).setValues(rows);
        }
      }
      
      if (postData.settings) {
        var settingsSheet = getSettingsSheet();
        var settings = postData.settings;
        var sKeys = Object.keys(settings);
        var sRows = settingsSheet.getDataRange().getValues();
        for (var k = 0; k < sKeys.length; k++) {
          var kName = sKeys[k];
          var val = settings[kName];
          var foundK = false;
          for (var r = 1; r < sRows.length; r++) {
            if (String(sRows[r][0]) === String(kName)) {
              settingsSheet.getRange(r + 1, 2).setValue(val);
              foundK = true;
              break;
            }
          }
          if (!foundK) {
            settingsSheet.appendRow([kName, val]);
            sRows.push([kName, val]);
          }
        }
      }

      out = { success: true };
    } 
    // 2. เพิ่มหรือแก้ไขลิงก์เดี่ยว
    else if (action === "add" || action === "update") {
      var link = postData.link;
      var audVal = link.targetAudience === "staff" ? "Staff" : (link.targetAudience === "student" ? "Student" : (link.isStaffOnly ? "Staff" : "Both"));
      var rows = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(link.id)) {
          sheet.getRange(i + 1, 1, 1, 9).setValues([[
            link.id || "",
            link.title || "",
            link.url || "",
            link.description || "",
            audVal,
            link.clickCount || 0,
            link.createdAt || "",
            link.thumbnailUrl || "",
            link.isPinned ? 'Yes' : 'No'
          ]]);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([
          link.id || "",
          link.title || "",
          link.url || "",
          link.description || "",
          audVal,
          link.clickCount || 0,
          link.createdAt || "",
          link.thumbnailUrl || "",
          link.isPinned ? 'Yes' : 'No'
        ]);
      }
      out = { success: true };
    } 
    // 3. ลบลิงก์
    else if (action === "delete") {
      var id = postData.id;
      var rows = sheet.getDataRange().getValues();
      for (var i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
        }
      }
      out = { success: true };
    } 
    // 4. บันทึกยอดนับคลิกแบบเรียลไทม์
    else if (action === "incrementClick") {
      var id = postData.id;
      var rows = sheet.getDataRange().getValues();
      var newCount = 0;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          var currentClick = parseInt(rows[i][5] || "0", 10);
          newCount = currentClick + 1;
          sheet.getRange(i + 1, 6).setValue(newCount);
          break;
        }
      }
      out = { success: true, id: id, newClickCount: newCount };
    } 
    // 5. บันทึกการตั้งค่าเว็บไซต์ (Settings)
    else if (action === "saveSettings") {
      var settingsSheet = getSettingsSheet();
      var settings = postData.settings || {};
      var keys = Object.keys(settings);
      var rows = settingsSheet.getDataRange().getValues();
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var value = settings[key];
        var foundKey = false;
        for (var r = 1; r < rows.length; r++) {
          if (String(rows[r][0]) === String(key)) {
            settingsSheet.getRange(r + 1, 2).setValue(value);
            foundKey = true;
            break;
          }
        }
        if (!foundKey) {
          settingsSheet.appendRow([key, value]);
          rows.push([key, value]); 
        }
      }
      out = { success: true };
    }
    // 5.1 บันทึกรหัสผ่านบุคลากร (Staff Passwords)
    else if (action === "saveStaffPasswords") {
      var meStaff = findAdmin(postData.auth && postData.auth.username, postData.auth && postData.auth.password);
      if (!meStaff) {
        out = { success: false, error: "Unauthorized" };
      } else {
        var settingsSheet = getSettingsSheet();
        var sRows = settingsSheet.getDataRange().getValues();
        var keysToUpdate = {
          "staffPasswords": JSON.stringify(postData.passwords || []),
          "staffPasswordItems": JSON.stringify(postData.passwordItems || [])
        };
        for (var skey in keysToUpdate) {
          var sval = keysToUpdate[skey];
          var fK = false;
          for (var r = 1; r < sRows.length; r++) {
            if (String(sRows[r][0]) === skey) {
              settingsSheet.getRange(r + 1, 2).setValue(sval);
              fK = true;
              break;
            }
          }
          if (!fK) {
            settingsSheet.appendRow([skey, sval]);
            sRows.push([skey, sval]);
          }
        }
        out = { success: true };
      }
    }
    // 6. เข้าสู่ระบบด้วยบัญชีในชีต Admins
    else if (action === "login") {
      var user = findAdmin(postData.username, postData.password);
      out = user ? { success: true, user: user } : { success: false, error: "Invalid credentials" };
    }
    // 6.1 เข้าหมวดบุคลากรด้วยรหัสผ่านอย่างเดียว (ตรงกับรหัสผ่านของบัญชีใดก็ได้ในชีต Admins หรือ Settings)
    else if (action === "staffLogin") {
      var pw = String(postData.password || "").trim();
      var ok = false;
      if (pw) {
        // 1. ตรวจสอบในชีต Admins
        var aRows = getAdminsSheet().getDataRange().getValues();
        for (var sr = 1; sr < aRows.length; sr++) {
          if (String(aRows[sr][0]) && String(aRows[sr][1]) === pw) { ok = true; break; }
        }
        // 2. ตรวจสอบในชีต Settings (staffPasswords / staffPasswordItems)
        if (!ok) {
          var sRows = getSettingsSheet().getDataRange().getValues();
          for (var sk = 1; sk < sRows.length; sk++) {
            var sKey = String(sRows[sk][0]).trim();
            if (sKey === "staffPasswords" || sKey === "staffPasswordItems") {
              try {
                var list = JSON.parse(String(sRows[sk][1]));
                if (Array.isArray(list)) {
                  for (var li = 0; li < list.length; li++) {
                    var item = list[li];
                    if (typeof item === "string" && item === pw) { ok = true; break; }
                    if (item && item.code === pw) { ok = true; break; }
                  }
                }
              } catch(e) {}
            }
          }
        }
      }
      out = ok ? { success: true } : { success: false, error: "Invalid password" };
    }
    // 7. เพิ่มหรือแก้ไขแอดมิน (superadmin หรือแอดมินเพิ่มบทบาท staff หรือแก้รหัสตัวเอง)
    else if (action === "saveAdmin") {
      var me = findAdmin(postData.auth && postData.auth.username, postData.auth && postData.auth.password);
      var admin = postData.admin || {};
      var isSelf = me && String(me.username).toLowerCase() === String(admin.username || "").toLowerCase();
      var isStaffAccount = admin.role === "staff";
      if (!me || (me.role !== "superadmin" && !isSelf && !isStaffAccount)) {
        out = { success: false, error: "Unauthorized" };
      } else {
        var adminsSheet = getAdminsSheet();
        var aRows = adminsSheet.getDataRange().getValues();
        var aFound = false;
        for (var a = 1; a < aRows.length; a++) {
          if (String(aRows[a][0]).toLowerCase() === String(admin.username).toLowerCase()) {
            adminsSheet.getRange(a + 1, 2).setValue(admin.password);
            if ((me.role === "superadmin" || isStaffAccount) && admin.role) {
              adminsSheet.getRange(a + 1, 3).setValue(admin.role);
            }
            aFound = true;
            break;
          }
        }
        if (!aFound) {
          adminsSheet.appendRow([admin.username, admin.password, admin.role || "staff", "[]"]);
        }
        out = { success: true };
      }
    }
    // 8. ลบแอดมิน (superadmin หรือลบบัญชี staff)
    else if (action === "deleteAdmin") {
      var me2 = findAdmin(postData.auth && postData.auth.username, postData.auth && postData.auth.password);
      if (!me2) {
        out = { success: false, error: "Unauthorized" };
      } else {
        var adminsSheet2 = getAdminsSheet();
        var dRows = adminsSheet2.getDataRange().getValues();
        for (var d = dRows.length - 1; d >= 1; d--) {
          if (String(dRows[d][0]).toLowerCase() === String(postData.username).toLowerCase()) {
            var targetRole = String(dRows[d][2] || "admin");
            if (me2.role === "superadmin" || targetRole === "staff") {
              adminsSheet2.deleteRow(d + 1);
            }
          }
        }
        out = { success: true };
      }
    }
    // 9. บันทึกลิงก์ที่ปักหมุดส่วนตัว
    else if (action === "updatePins") {
      var me3 = findAdmin(postData.auth && postData.auth.username, postData.auth && postData.auth.password);
      if (!me3) {
        out = { success: false, error: "Unauthorized" };
      } else {
        var adminsSheet3 = getAdminsSheet();
        var pRows = adminsSheet3.getDataRange().getValues();
        for (var q = 1; q < pRows.length; q++) {
          if (String(pRows[q][0]).toLowerCase() === String(me3.username).toLowerCase()) {
            adminsSheet3.getRange(q + 1, 4).setValue(JSON.stringify(postData.pinnedLinks || []));
            break;
          }
        }
        out = { success: true };
      }
    }
  } catch (err) {
    out = { success: false, error: err.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
  
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ค้นหาแอดมินจากชีต Admins ด้วยชื่อผู้ใช้และรหัสผ่าน (ไม่ส่งรหัสผ่านกลับ)
function findAdmin(username, password) {
  if (!username || !password) return null;
  var rows = getAdminsSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(username).toLowerCase() && String(rows[i][1]) === String(password)) {
      var pins = [];
      try { pins = JSON.parse(rows[i][3] || "[]"); } catch (e) {}
      return { username: String(rows[i][0]), role: String(rows[i][2] || "admin"), pinnedLinks: pins };
    }
  }
  return null;
}

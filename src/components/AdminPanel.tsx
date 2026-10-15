import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, AdminConfig, User, AuthCredentials, StaffPasswordItem } from "../types";
import { 
  X, Save, Trash2, Edit2, Key, Info, FolderPlus, 
  Grid, Link2, CheckCircle2, AlertCircle, RefreshCw, Settings,
  Upload, FileImage, Pin, BarChart3, Bell, Plus, Users, ShieldAlert, ShieldCheck,
  Lock, Download, Copy, Check, FileJson, GraduationCap, Briefcase,
  ExternalLink, Eye, EyeOff, UserCheck, Search, TrendingUp, Sparkles, BarChart2,
  Building2, FlaskConical, GripVertical, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, ArrowUpDown, Wrench
} from "lucide-react";
import { AVAILABLE_ICONS, DynamicIcon } from "./DynamicIcon";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { addAdminViaWebApp, deleteAdminViaWebApp } from "../googleSheets";

// Google Sheets cells hold up to 50,000 characters; keep pasted pictures safely below that.
const SHEET_CELL_LIMIT = 45000;

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  links: Link[];
  currentUser: User | null;
  authCreds: AuthCredentials | null;
  adminConfig: AdminConfig;
  onUpdateConfig: (config: AdminConfig) => Promise<void>;
  onAddLink: (link: Omit<Link, "id" | "clickCount" | "createdAt">) => Promise<void>;
  onUpdateLink: (id: string, updates: Partial<Link>) => Promise<void>;
  onDeleteLink: (id: string) => Promise<void>;
  onReorderLinks?: (reorderedLinks: Link[]) => Promise<void>;
}

const GAS_SCRIPT_TEMPLATE = `var SPREADSHEET_ID = "1pphCw3O30znOqQeyAgYsv9P4M6SRVGFVdn_aDbDqwPY";
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
      "ID", "Title", "URL", "Description", "Target Audience", "Click Count", "Created At", "Thumbnail URL", "Is Pinned", "Category"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
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
    return SPREADSHEET_ID === "YOUR_SPREADSHEET_ID_HERE" ? SpreadsheetApp.getActiveSpreadsheet() : SpreadsheetApp.openById(SPREADSHEET_ID);
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
      "ID", "Title", "URL", "Description", "Target Audience", "Click Count", "Created At", "Thumbnail URL", "Is Pinned", "Category"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
  } else if (sheet.getLastColumn() < 10) {
    sheet.getRange(1, 10).setValue("Category").setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
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

        var rawCat = String(row[9] || "").trim().toLowerCase();
        var category = "faculty";
        if (rawCat === "university" || rawCat === "uni" || rawCat === "มหาวิทยาลัย") {
          category = "university";
        } else if (rawCat === "faculty" || rawCat === "fac" || rawCat === "คณะวิทยาศาสตร์" || rawCat === "คณะ") {
          category = "faculty";
        } else {
          var text = (String(row[2] || "") + " " + String(row[1] || "")).toLowerCase();
          category = (text.indexOf("scitech") >= 0 || text.indexOf("คณะวิทยาศาสตร์") >= 0 || text.indexOf("petition.") >= 0 || text.indexOf("fst") >= 0 || text.indexOf("wise") >= 0) ? "faculty" : "university";
        }

        results.push({
          id: String(row[0]),
          title: String(row[1]),
          url: String(row[2]),
          description: String(row[3]),
          targetAudience: targetAudience,
          category: category,
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
          sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
        }
        if (links.length > 0) {
          var rows = [];
          for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var audVal = link.targetAudience === "staff" ? "Staff" : (link.targetAudience === "student" ? "Student" : (link.isStaffOnly ? "Staff" : "Both"));
            var catVal = link.category === "university" ? "University" : "Faculty";
            rows.push([
              link.id || "",
              link.title || "",
              link.url || "",
              link.description || "",
              audVal,
              link.clickCount || 0,
              link.createdAt || "",
              link.thumbnailUrl || "",
              link.isPinned ? 'Yes' : 'No',
              catVal
            ]);
          }
          sheet.getRange(2, 1, rows.length, 10).setValues(rows);
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
      var catVal = link.category === "university" ? "University" : "Faculty";
      var rows = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(link.id)) {
          sheet.getRange(i + 1, 1, 1, 10).setValues([[
            link.id || "",
            link.title || "",
            link.url || "",
            link.description || "",
            audVal,
            link.clickCount || 0,
            link.createdAt || "",
            link.thumbnailUrl || "",
            link.isPinned ? 'Yes' : 'No',
            catVal
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
          link.isPinned ? 'Yes' : 'No',
          catVal
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
    // 4. บันทึกยอดนับคลิก
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
      var staffName = "บุคลากร";
      if (pw) {
        // 1. ตรวจสอบในชีต Admins
        var aRows = getAdminsSheet().getDataRange().getValues();
        for (var sr = 1; sr < aRows.length; sr++) {
          if (String(aRows[sr][0]) && String(aRows[sr][1]) === pw) {
            ok = true;
            staffName = String(aRows[sr][0]);
            break;
          }
        }
        // 2. ตรวจสอบในชีต Settings (staffPasswordItems / staffPasswords)
        if (!ok) {
          var sRows = getSettingsSheet().getDataRange().getValues();
          for (var sk = 1; sk < sRows.length; sk++) {
            var sKey = String(sRows[sk][0]).trim();
            if (sKey === "staffPasswordItems") {
              try {
                var list = JSON.parse(String(sRows[sk][1]));
                if (Array.isArray(list)) {
                  for (var li = 0; li < list.length; li++) {
                    var item = list[li];
                    if (item && String(item.code || "").trim() === pw) {
                      ok = true;
                      staffName = item.label || item.name || "บุคลากร";
                      break;
                    }
                  }
                }
              } catch(e) {}
            }
            if (!ok && sKey === "staffPasswords") {
              try {
                var list2 = JSON.parse(String(sRows[sk][1]));
                if (Array.isArray(list2)) {
                  for (var li2 = 0; li2 < list2.length; li2++) {
                    var item2 = list2[li2];
                    if (typeof item2 === "string" && item2 === pw) {
                      ok = true;
                      staffName = "บุคลากร";
                      break;
                    }
                  }
                }
              } catch(e) {}
            }
          }
        }
      }
      out = ok ? { success: true, staffName: staffName } : { success: false, error: "Invalid password" };
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
`;

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  links,
  currentUser,
  authCreds,
  adminConfig,
  onUpdateConfig,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onReorderLinks,
}) => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "links" | "sheets" | "staff" | "security" | "admins">("dashboard");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Success / Error messages
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reorder State & Handlers
  const [orderedLinks, setOrderedLinks] = useState<Link[]>(links);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    setOrderedLinks(links);
  }, [links]);

  const handleMoveLink = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedLinks.length || fromIndex === toIndex) return;
    const reordered = [...orderedLinks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const withOrder = reordered.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setOrderedLinks(withOrder);

    if (onReorderLinks) {
      setIsSavingOrder(true);
      try {
        await onReorderLinks(withOrder);
        showAlert(`สลับตำแหน่ง: ย้าย "${moved.title}" ไปลำดับที่ ${toIndex + 1} เรียบร้อยแล้ว`);
      } catch (e) {
        showAlert("เกิดข้อผิดพลาดในการบันทึกลำดับ", "error");
      } finally {
        setIsSavingOrder(false);
      }
    }
  };

  const handleLinkDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleLinkDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleLinkDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleLinkDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    await handleMoveLink(draggedIndex, targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Links Tab search & category filters
  const [linksTabSearch, setLinksTabSearch] = useState("");
  const [linksTabCategory, setLinksTabCategory] = useState<"all" | "university" | "faculty">("all");

  const displayedOrderedLinks = useMemo(() => {
    return orderedLinks.filter(l => {
      if (linksTabCategory !== "all") {
        const cat = l.category || 'faculty';
        if (cat !== linksTabCategory) return false;
      }
      if (linksTabSearch.trim()) {
        const q = linksTabSearch.toLowerCase().trim();
        return (
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [orderedLinks, linksTabCategory, linksTabSearch]);

  // Link Form State
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkCategory, setLinkCategory] = useState<"university" | "faculty">("faculty");
  const [linkThumbnailUrl, setLinkThumbnailUrl] = useState("");

  // Upload, Drag and Paste Image States & Refs
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup & Restore state
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCopiedBackup, setIsCopiedBackup] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Crop & Resize Image Helper to exactly fit the 16:10 card aspect ratio
  const resizeAndCropImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(event.target?.result as string || "");
            return;
          }

          // A Google Sheets cell holds at most 50,000 characters, and a picture that does not fit
          // makes the whole save fail (it then vanishes on the next sync). Shrink until it fits.
          const attempts: [number, number, number][] = [
            [640, 400, 0.72], [560, 350, 0.65], [480, 300, 0.6], [400, 250, 0.55], [320, 200, 0.5], [256, 160, 0.45],
          ];
          let dataUrl = "";
          for (const [targetWidth, targetHeight, quality] of attempts) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Crop and scale "cover" calculations (16:10, matching the link card)
            const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
            const x = (targetWidth / 2) - (img.width / 2) * scale;
            const y = (targetHeight / 2) - (img.height / 2) * scale;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            dataUrl = canvas.toDataURL("image/jpeg", quality);
            if (dataUrl.length <= SHEET_CELL_LIMIT) break;
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showAlert("กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
      return;
    }
    setIsProcessingImage(true);
    try {
      const base64Data = await resizeAndCropImage(file);
      setLinkThumbnailUrl(base64Data);
      showAlert("อัปโหลดและปรับสัดส่วนภาพประกอบเรียบร้อย");
    } catch (err) {
      console.error(err);
      showAlert("ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleImageDragLeave = () => {
    setIsDragging(false);
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleImageFile(files[0]);
    }
  };

  // Capture Clipboard Paste (Ctrl+V) anywhere on the window/modal when activeTab is "links"
  useEffect(() => {
    if (!isOpen || activeTab !== "links") return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Check if target is an input field to avoid interrupting text inputs unless it's a file
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          // If they pasted an image file, process it!
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [isOpen, activeTab]);

  // Security Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Announcement Form State
  const [announcementText, setAnnouncementText] = useState(adminConfig.announcementText || "");
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(adminConfig.isAnnouncementActive || false);
  
  // Staff Password Form State
  const [staffPasswords, setStaffPasswords] = useState<string[]>(adminConfig.staffPasswords || []);
  const [staffPasswordItems, setStaffPasswordItems] = useState<StaffPasswordItem[]>(() => {
    if (adminConfig.staffPasswordItems && adminConfig.staffPasswordItems.length > 0) {
      return adminConfig.staffPasswordItems;
    }
    return (adminConfig.staffPasswords || []).map((code, idx) => ({
      id: `spw-${idx}`,
      label: idx === 0 ? "รหัสกลางบุคลากร" : `รหัสบุคลากรชุดที่ ${idx + 1}`,
      code,
      createdAt: new Date().toISOString()
    }));
  });
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffPasswordLabel, setNewStaffPasswordLabel] = useState("");
  const [newStaffDepartment, setNewStaffDepartment] = useState("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [showPasswordIds, setShowPasswordIds] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // New Staff Account (Individual login) Form State
  const [newStaffUsername, setNewStaffUsername] = useState("");
  const [newStaffAccountPassword, setNewStaffAccountPassword] = useState("");
  
  // Site Info Form State
  const [siteTitle, setSiteTitle] = useState(adminConfig.siteTitle || "");
  const [siteLogoUrl, setSiteLogoUrl] = useState(adminConfig.siteLogoUrl || "");

  // Sync admin config state on open
  useEffect(() => {
    if (isOpen) {
      setAnnouncementText(adminConfig.announcementText || "");
      setIsAnnouncementActive(adminConfig.isAnnouncementActive || false);
      setStaffPasswords(adminConfig.staffPasswords || []);
      if (adminConfig.staffPasswordItems && adminConfig.staffPasswordItems.length > 0) {
        setStaffPasswordItems(adminConfig.staffPasswordItems);
      } else if (adminConfig.staffPasswords && adminConfig.staffPasswords.length > 0) {
        setStaffPasswordItems(adminConfig.staffPasswords.map((code, idx) => ({
          id: `spw-${idx}`,
          label: idx === 0 ? "รหัสกลางบุคลากร" : `รหัสบุคลากรชุดที่ ${idx + 1}`,
          code,
          createdAt: new Date().toISOString()
        })));
      }
      setSiteTitle(adminConfig.siteTitle || "");
      setSiteLogoUrl(adminConfig.siteLogoUrl || "");
    }
  }, [isOpen, adminConfig]);

  // Target Audience, Pin & Maintenance State
  const [linkTargetAudience, setLinkTargetAudience] = useState<"both" | "student" | "staff">("both");
  const [linkIsStaffOnly, setLinkIsStaffOnly] = useState(false);
  const [linkIsPinned, setLinkIsPinned] = useState(false);
  const [linkIsMaintenance, setLinkIsMaintenance] = useState(false);
  const [linkMaintenanceNote, setLinkMaintenanceNote] = useState("");

  // Dashboard Real-time table filter & search
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardAudienceFilter, setDashboardAudienceFilter] = useState<"all" | "student" | "staff" | "both">("all");
  const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<"all" | "university" | "faculty">("all");

  // Custom Confirm State
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; title: string } | null>(null);

  // Admin Accounts State
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "superadmin" | "staff">("admin");
  const [myNewPassword, setMyNewPassword] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scitech_admin_users");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAdminUsers(parsed);
          return;
        }
      }
    } catch (e) {}

    // Only create default admin on fresh install if never initialized before
    if (!localStorage.getItem("scitech_admin_users_initialized")) {
      const defaultAdmin = {
        username: "admin",
        password: adminConfig.adminPassword || "admin1234",
        role: "superadmin" as const,
        pinnedLinks: []
      };
      setAdminUsers([defaultAdmin]);
      localStorage.setItem("scitech_admin_users", JSON.stringify([defaultAdmin]));
      localStorage.setItem("scitech_admin_users_initialized", "true");
    }
  }, [adminConfig.adminPassword]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername || !newAdminPassword) {
      showAlert("กรุณากรอก Username และ Password", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      if (adminConfig.googleAppsScriptUrl && authCreds) {
        await addAdminViaWebApp(adminConfig.googleAppsScriptUrl, {
          username: newAdminUsername,
          password: newAdminPassword,
          role: newAdminRole
        }, authCreds);
      }
      
      const updated = [
        ...adminUsers.filter(a => a.username !== newAdminUsername),
        { username: newAdminUsername, role: newAdminRole, password: newAdminPassword, pinnedLinks: [] }
      ];
      setAdminUsers(updated);
      localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
      localStorage.setItem("scitech_admin_users_initialized", "true");

      if (newAdminUsername === "admin") {
        await onUpdateConfig({ ...adminConfig, adminPassword: newAdminPassword });
      }
      
      setNewAdminUsername("");
      setNewAdminPassword("");
      showAlert("เพิ่ม/อัปเดตแอดมินสำเร็จแล้ว");
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการเพิ่มแอดมิน", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (username: string) => {
    if (adminUsers.length <= 1) {
      showAlert("ไม่สามารถลบได้ ต้องมีบัญชีแอดมินเหลืออย่างน้อย 1 บัญชี เพื่อป้องกันระบบถูกล็อก", "error");
      return;
    }

    const isCurrent = currentUser?.username && username.toLowerCase() === currentUser.username.toLowerCase();
    const confirmMsg = isCurrent
      ? `ยืนยันการลบบัญชี ${username}? เนื่องจากเป็นบัญชีที่กำลังใช้งานอยู่ ระบบจะออกจากระบบเพื่อให้คุณเข้าสู่ระบบด้วยบัญชีแอดมินอื่น`
      : `ยืนยันการลบแอดมิน: ${username}?`;

    if (!window.confirm(confirmMsg)) return;
    
    setIsSubmitting(true);
    try {
      if (adminConfig.googleAppsScriptUrl && authCreds) {
        await deleteAdminViaWebApp(adminConfig.googleAppsScriptUrl, username, authCreds);
      }
      const updated = adminUsers.filter(a => a.username.toLowerCase() !== username.toLowerCase());
      setAdminUsers(updated);
      localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
      localStorage.setItem("scitech_admin_users_initialized", "true");
      showAlert(`ลบแอดมิน ${username} สำเร็จ`);

      if (isCurrent) {
        sessionStorage.removeItem("scitech_auth_creds");
        sessionStorage.removeItem("scitech_user");
        window.location.reload();
      }
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการลบแอดมิน", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myNewPassword.trim() || !currentUser) {
      showAlert("กรุณากรอกรหัสผ่านใหม่", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      if (adminConfig.googleAppsScriptUrl && authCreds) {
        await addAdminViaWebApp(adminConfig.googleAppsScriptUrl, {
          username: currentUser.username,
          password: myNewPassword.trim(),
          role: currentUser.role
        }, authCreds);
      }

      const updated = adminUsers.map(a => 
        a.username === currentUser.username ? { ...a, password: myNewPassword.trim() } : a
      );
      if (!updated.some(a => a.username === currentUser.username)) {
        updated.push({
          username: currentUser.username,
          role: currentUser.role,
          password: myNewPassword.trim(),
          pinnedLinks: currentUser.pinnedLinks || []
        });
      }
      setAdminUsers(updated);
      localStorage.setItem("scitech_admin_users", JSON.stringify(updated));

      if (currentUser.username === "admin") {
        await onUpdateConfig({ ...adminConfig, adminPassword: myNewPassword.trim() });
      }

      const newCreds = { username: currentUser.username, password: myNewPassword.trim() };
      sessionStorage.setItem("scitech_auth_creds", JSON.stringify(newCreds));

      setMyNewPassword("");
      showAlert("เปลี่ยนรหัสผ่านของคุณเรียบร้อยแล้ว");
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "admins" && currentUser?.role === "superadmin") {
      // Trigger load admins
      // loadAdmins();
    }
  }, [activeTab, currentUser]);

  if (!isOpen) return null;

  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Handle Link submit
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle || !linkUrl) {
      showAlert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", "error");
      return;
    }

    const targetAud = linkTargetAudience;
    const isStaff = targetAud === "staff";

    setIsSubmitting(true);
    try {
      if (editingLinkId) {
        await onUpdateLink(editingLinkId, {
          title: linkTitle,
          url: linkUrl,
          description: linkDesc,
          targetAudience: targetAud,
          category: linkCategory,
          isStaffOnly: isStaff,
          thumbnailUrl: linkThumbnailUrl,
          isPinned: linkIsPinned,
          isMaintenance: linkIsMaintenance,
          maintenanceNote: linkMaintenanceNote,
        });
        showAlert("อัปเดตลิงก์สำเร็จแล้ว");
        setEditingLinkId(null);
      } else {
        await onAddLink({
          title: linkTitle,
          url: linkUrl,
          description: linkDesc,
          targetAudience: targetAud,
          category: linkCategory,
          isStaffOnly: isStaff,
          thumbnailUrl: linkThumbnailUrl,
          isPinned: linkIsPinned,
          isMaintenance: linkIsMaintenance,
          maintenanceNote: linkMaintenanceNote,
        });
        showAlert("เพิ่มลิงก์ใหม่เรียบร้อยแล้ว");
      }
      // Reset state
      setLinkTitle("");
      setLinkUrl("");
      setLinkDesc("");
      setLinkCategory("faculty");
      setLinkTargetAudience("both");
      setLinkIsStaffOnly(false);
      setLinkIsPinned(false);
      setLinkIsMaintenance(false);
      setLinkMaintenanceNote("");
      setLinkThumbnailUrl("");
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Announcement Update
  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdateConfig({
        announcementText,
        isAnnouncementActive
      });
      showAlert("อัปเดตประกาศแจ้งเตือนสำเร็จแล้ว");
    } catch (err) {
      showAlert("ไม่สามารถอัปเดตประกาศได้", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Site Info Update
  const handleSiteInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdateConfig({
        siteTitle,
        siteLogoUrl
      });
      showAlert("อัปเดตข้อมูลเว็บไซต์สำเร็จแล้ว");
    } catch (err) {
      showAlert("ไม่สามารถอัปเดตข้อมูลเว็บไซต์ได้", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showAlert("กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          
          // Max size for logo 256x256
          const maxSize = 256;
          let width = img.width;
          let height = img.height;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          
          // Shrink the logo until it fits in one sheet cell (see SHEET_CELL_LIMIT)
          let dataUrl = "";
          for (let shrink = 1; shrink >= 0.25; shrink /= 1.5) {
            canvas.width = Math.max(1, Math.round(width * shrink));
            canvas.height = Math.max(1, Math.round(height * shrink));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL("image/png");
            if (dataUrl.length <= SHEET_CELL_LIMIT) break;
            dataUrl = canvas.toDataURL("image/webp", 0.8);
            if (dataUrl.length <= SHEET_CELL_LIMIT) break;
          }
          setSiteLogoUrl(dataUrl);
          setIsSubmitting(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showAlert("ไม่สามารถประมวลผลรูปภาพได้", "error");
      setIsSubmitting(false);
    }
  };

  // Handle Staff Password Update
  const handleAddStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newStaffPassword.trim();
    const label = newStaffPasswordLabel.trim();
    if (!label) {
      showAlert("กรุณาระบุชื่อบัญชีหรือชื่อบุคลากร", "error");
      return;
    }
    if (!code) {
      showAlert("กรุณาระบุรหัสผ่านเข้าใช้งาน", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newItem: StaffPasswordItem = {
        id: `spw-${Date.now()}`,
        label,
        code,
        department: newStaffDepartment.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || "แอดมิน"
      };
      const updatedItems = [...staffPasswordItems.filter(i => i.code !== code), newItem];
      const updatedPasswords = Array.from(new Set([...staffPasswords, code]));
      
      const { hashStaffCode } = await import('../staffCodes');
      const newHash = await hashStaffCode(code);
      const existingHashes = adminConfig.staffCodeHashes || [];
      const updatedHashes = existingHashes.includes(newHash) ? existingHashes : [...existingHashes, newHash];

      setStaffPasswords(updatedPasswords);
      setStaffPasswordItems(updatedItems);
      setNewStaffPassword("");
      setNewStaffPasswordLabel("");
      setNewStaffDepartment("");

      await onUpdateConfig({
        ...adminConfig,
        staffPasswords: updatedPasswords,
        staffPasswordItems: updatedItems,
        staffCodeHashes: updatedHashes
      });

      if (adminConfig.googleAppsScriptUrl && authCreds) {
        const { sendActionToWebApp } = await import('../googleSheets');
        sendActionToWebApp(adminConfig.googleAppsScriptUrl, 'saveStaffPasswords', {
          passwords: updatedPasswords,
          passwordItems: updatedItems
        }, authCreds);
      }

      showAlert(`บันทึกบัญชีบุคลากร "${label}" (รหัส: ${code}) เรียบร้อยแล้ว`);
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการบันทึกข้อมูลบุคลากร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStaffPassword = async (itemToRemove: StaffPasswordItem | string) => {
    setIsSubmitting(true);
    try {
      const codeToRemove = typeof itemToRemove === "string" ? itemToRemove : itemToRemove.code;
      const idToRemove = typeof itemToRemove === "string" ? "" : itemToRemove.id;
      const updatedItems = staffPasswordItems.filter(i => (idToRemove ? i.id !== idToRemove : true) && i.code !== codeToRemove);
      const remainingCodes = updatedItems.map(i => i.code);
      const { hashStaffCode } = await import('../staffCodes');
      const removedHash = await hashStaffCode(codeToRemove);
      const updatedHashes = (adminConfig.staffCodeHashes || []).filter(h => h !== removedHash);

      setStaffPasswords(remainingCodes);
      setStaffPasswordItems(updatedItems);

      await onUpdateConfig({
        ...adminConfig,
        staffPasswords: remainingCodes,
        staffPasswordItems: updatedItems,
        staffCodeHashes: updatedHashes
      });

      if (adminConfig.googleAppsScriptUrl && authCreds) {
        const { sendActionToWebApp } = await import('../googleSheets');
        sendActionToWebApp(adminConfig.googleAppsScriptUrl, 'saveStaffPasswords', {
          passwords: remainingCodes,
          passwordItems: updatedItems
        }, authCreds);
      }

      const labelToRemove = typeof itemToRemove === "string" ? itemToRemove : (itemToRemove.label || itemToRemove.code);
      showAlert(`ลบรหัส "${labelToRemove}" เรียบร้อยแล้ว`);
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการลบบัญชีบุคลากร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateRandomStaffCode = () => {
    const prefixes = ["STAFF", "SCI", "FST"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setNewStaffPassword(`${prefix}-${randomNum}`);
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
    showAlert(`คัดลอกรหัสผ่าน "${code}" แล้ว`);
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswordIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffUsername.trim() || !newStaffAccountPassword.trim()) {
      showAlert("กรุณากรอก Username และ Password ของบุคลากร", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      if (adminConfig.googleAppsScriptUrl && authCreds) {
        await addAdminViaWebApp(adminConfig.googleAppsScriptUrl, {
          username: newStaffUsername.trim(),
          password: newStaffAccountPassword.trim(),
          role: "staff"
        }, authCreds);
      }
      const updated = [
        ...adminUsers.filter(a => a.username.toLowerCase() !== newStaffUsername.trim().toLowerCase()),
        { username: newStaffUsername.trim(), role: "staff" as const, password: newStaffAccountPassword.trim(), pinnedLinks: [] }
      ];
      setAdminUsers(updated);
      localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
      setNewStaffUsername("");
      setNewStaffAccountPassword("");
      showAlert(`เพิ่มบัญชีบุคลากร "${newStaffUsername.trim()}" สำเร็จ`);
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการเพิ่มบัญชีบุคลากร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export & Import Backup handlers
  const handleExportBackup = () => {
    try {
      const backupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        siteTitle: adminConfig.siteTitle || "",
        siteLogoUrl: adminConfig.siteLogoUrl || "",
        adminConfig,
        links,
        adminUsers: JSON.parse(localStorage.getItem("scitech_admin_users") || "[]"),
      };
      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scitech-linkhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus({ type: 'success', message: 'ดาวน์โหลดไฟล์สำรองข้อมูล (.json) สำเร็จแล้ว!' });
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      setBackupStatus({ type: 'error', message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ดาวน์โหลด' });
    }
  };

  const handleCopyBackupJSON = async () => {
    try {
      const backupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        siteTitle: adminConfig.siteTitle || "",
        siteLogoUrl: adminConfig.siteLogoUrl || "",
        adminConfig,
        links,
        adminUsers: JSON.parse(localStorage.getItem("scitech_admin_users") || "[]"),
      };
      await navigator.clipboard.writeText(JSON.stringify(backupData, null, 2));
      setIsCopiedBackup(true);
      setBackupStatus({ type: 'success', message: 'คัดลอก JSON เรียบร้อยแล้ว! สามารถนำไปวางได้ทันที' });
      setTimeout(() => {
        setIsCopiedBackup(false);
        setBackupStatus(null);
      }, 4000);
    } catch (err) {
      setBackupStatus({ type: 'error', message: 'ไม่สามารถคัดลอกลงคลิปบอร์ดได้ กรุณาใช้ปุ่มดาวน์โหลดไฟล์แทน' });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.links && Array.isArray(parsed.links)) {
          localStorage.setItem("scitech_links", JSON.stringify(parsed.links));
        }
        if (parsed.adminConfig && typeof parsed.adminConfig === "object") {
          localStorage.setItem("scitech_admin_config", JSON.stringify(parsed.adminConfig));
          await onUpdateConfig(parsed.adminConfig);
        }
        if (parsed.adminUsers && Array.isArray(parsed.adminUsers)) {
          localStorage.setItem("scitech_admin_users", JSON.stringify(parsed.adminUsers));
        }
        setBackupStatus({ type: 'success', message: 'นำเข้าข้อมูลสำเร็จ! กำลังรีเฟรชหน้าเว็บเพื่อปรับปรุงการแสดงผล...' });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err) {
        setBackupStatus({ type: 'error', message: 'ไฟล์ไม่ถูกต้อง กรุณาตรวจสอบว่าเป็นไฟล์ JSON จากระบบ' });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const startEditLink = (link: Link) => {
    setEditingLinkId(link.id);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkDesc(link.description || "");
    const aud = link.targetAudience || (link.isStaffOnly ? "staff" : "both");
    setLinkTargetAudience(aud);
    setLinkIsStaffOnly(aud === "staff");
    setLinkCategory(link.category || "faculty");
    setLinkIsPinned(link.isPinned || false);
    setLinkIsMaintenance(link.isMaintenance || false);
    setLinkMaintenanceNote(link.maintenanceNote || "");
    setLinkThumbnailUrl(link.thumbnailUrl || "");
    // Scroll to form
    document.getElementById("link-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const togglePinStatus = async (link: Link) => {
    try {
      if (currentUser?.role === "superadmin") {
         // Superadmin changes global pin
         await onUpdateLink(link.id, { isPinned: !link.isPinned });
         showAlert(`อัปเดตสถานะปักหมุดลิงก์ "${link.title}" แล้ว`);
      } else {
         // Normal admin changes their personal pin
         const currentPins = currentUser?.pinnedLinks || [];
         let updatedPins = [];
         if (currentPins.includes(link.id)) {
            updatedPins = currentPins.filter(id => id !== link.id);
            showAlert(`ยกเลิกปักหมุดส่วนตัว "${link.title}" แล้ว`);
         } else {
            updatedPins = [...currentPins, link.id];
            showAlert(`ปักหมุดส่วนตัว "${link.title}" แล้ว`);
         }
         
         if (adminConfig.googleAppsScriptUrl && authCreds) {
            const { updatePersonalPinsViaWebApp } = await import('../googleSheets');
            await updatePersonalPinsViaWebApp(adminConfig.googleAppsScriptUrl, updatedPins, authCreds);
         }
         
         // Note: We need a way to propagate this back to App.tsx so currentUser updates.
         // We can emit it via a callback or just mutate local state (less ideal).
         if (currentUser) {
            currentUser.pinnedLinks = updatedPins;
         }
      }
    } catch (err) {
      showAlert("ไม่สามารถอัปเดตสถานะได้", "error");
    }
  };

  const executeDeleteLink = async () => {
    if (!linkToDelete) return;
    try {
      await onDeleteLink(linkToDelete.id);
      showAlert("ลบลิงก์เรียบร้อยแล้ว");
    } catch (err) {
      showAlert("ไม่สามารถลบลิงก์ได้", "error");
    } finally {
      setLinkToDelete(null);
    }
  };

  // Analytics and Real-time Statistics
  const totalClicks = useMemo(() => links.reduce((sum, l) => sum + (l.clickCount || 0), 0), [links]);
  const staffLinksCount = useMemo(() => links.filter(l => (l.targetAudience === 'staff' || l.isStaffOnly)).length, [links]);
  const studentLinksCount = useMemo(() => links.filter(l => l.targetAudience === 'student').length, [links]);
  const bothLinksCount = useMemo(() => links.filter(l => l.targetAudience === 'both' || (!l.targetAudience && !l.isStaffOnly)).length, [links]);

  const topLinksData = useMemo(() => {
    return [...links]
      .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
      .slice(0, 10)
      .map((l) => ({
        name: l.title.length > 22 ? l.title.substring(0, 22) + "..." : l.title,
        clicks: l.clickCount || 0,
        fullTitle: l.title
      }));
  }, [links]);

  // Filtered links for Real-time Dashboard table
  const dashboardFilteredLinks = useMemo(() => {
    return links.filter(link => {
      const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');
      if (dashboardAudienceFilter !== "all" && aud !== dashboardAudienceFilter) {
        return false;
      }
      const cat = link.category || 'faculty';
      if (dashboardCategoryFilter !== "all" && cat !== dashboardCategoryFilter) {
        return false;
      }
      if (dashboardSearch.trim()) {
        const q = dashboardSearch.toLowerCase();
        return link.title.toLowerCase().includes(q) || link.url.toLowerCase().includes(q) || (link.description && link.description.toLowerCase().includes(q));
      }
      return true;
    }).sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
  }, [links, dashboardAudienceFilter, dashboardCategoryFilter, dashboardSearch]);

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 lg:p-7">
      {linkToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 dark:bg-black/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-[#1a171a] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 text-[#5c0620] dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white text-center">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center leading-relaxed">
              คุณแน่ใจหรือไม่ที่จะลบลิงก์ <strong className="text-rose-600 dark:text-rose-400">"{linkToDelete.title}"</strong> ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLinkToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeDeleteLink}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Spacious Bento Modal Container */}
      <div className="bg-[#fcfaf9] dark:bg-[#121012] border border-slate-200/80 dark:border-white/10 rounded-[32px] w-full max-w-[1520px] h-[95vh] max-h-[1020px] flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181618] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-[#5c0620] text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
                  ระบบจัดการข้อมูลกลาง (Central Management)
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Bento Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                จัดการข้อมูลลิงก์ การจัดเรียงลำดับ หมวดหมู่ และระบบความปลอดภัยของคณะฯ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {currentUser && (
              <div className="hidden md:flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-white/10 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200">
                <UserCheck className="w-3.5 h-3.5 text-[#5c0620] dark:text-rose-400" />
                <span>{currentUser.username}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 text-[#5c0620] dark:text-rose-300 font-bold uppercase">
                  {currentUser.role}
                </span>
              </div>
            )}
            <button 
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs transition-all cursor-pointer active:scale-95 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40"
              title="ปิดหน้าต่างจัดการ (Esc)"
            >
              <X className="w-4 h-4" />
              <span>ปิดหน้าต่าง</span>
            </button>
          </div>
        </div>

        {/* Info Banner & Alerts */}
        {message && (
          <div className={`px-6 py-3.5 flex items-center gap-2.5 text-sm shrink-0 ${
            message.type === "success" 
              ? "bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/50 text-rose-900 dark:text-rose-200" 
              : "bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-200"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Bento Tab Navigation Bar */}
        <div className="px-6 py-3 bg-white/70 dark:bg-[#151315] border-b border-slate-200/80 dark:border-white/10 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                activeTab === "dashboard"
                  ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                  : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>แดชบอร์ดสถิติ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("links")}
              className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                activeTab === "links"
                  ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                  : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>จัดการลิงก์</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "links" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300"
              }`}>
                {links.length}
              </span>
            </button>
            
            <button
              type="button"
              onClick={() => setActiveTab("sheets")}
              className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                activeTab === "sheets"
                  ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                  : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>จัดการ Google Sheets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                activeTab === "staff"
                  ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                  : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>บัญชีบุคลากร</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "staff" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300"
              }`}>
                {staffPasswordItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                activeTab === "security"
                  ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                  : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>ตั้งค่าระบบ & สำรองข้อมูล</span>
            </button>

            {currentUser?.role === "superadmin" && (
              <button
                type="button"
                onClick={() => setActiveTab("admins")}
                className={`min-h-[46px] px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-2.5 ${
                  activeTab === "admins"
                    ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/25 scale-[1.02]"
                    : "bg-white dark:bg-[#1e1b1e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>บัญชีแอดมิน</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Content Area (Independent scroll for links tab) */}
        <div className={`flex-1 p-4 sm:p-6 bg-slate-50/50 dark:bg-[#121113] min-h-0 ${
          activeTab === "links" ? "xl:overflow-hidden overflow-y-auto flex flex-col" : "overflow-y-auto"
        }`}>
          
          {/* TAB 0: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top Banner with Real-time Status */}
              <div className="bg-gradient-to-r from-[#3b0211] via-[#5c0620] to-[#25030b] text-white p-6 sm:p-7 rounded-[28px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-rose-900/30">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] uppercase tracking-widest font-extrabold text-emerald-300">Live Analytics Engine</span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight">สถิติการเข้าใช้งานระบบ & ลิงก์สำคัญแบบเรียลไทม์</h3>
                  <p className="text-xs text-rose-200/90 max-w-2xl leading-relaxed">ยอดการคลิกเข้าชมและสถิติความนิยมจะอัปเดตแบบเรียลไทม์ทันทีเมื่อมีผู้ใช้งานเปิดลิงก์จากทุกอุปกรณ์</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md text-xs font-bold flex items-center gap-2 border border-white/10">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>ซิงค์อัตโนมัติ 24 ชม.</span>
                  </span>
                </div>
              </div>

              {/* KPI Bento Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1a171a] p-5 rounded-[24px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2 hover:border-[#5c0620]/30 transition-all">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">ยอดคลิกเข้าชมรวม</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-[#5c0620] dark:text-rose-400 flex items-center justify-center">
                      <BarChart2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{totalClicks.toLocaleString()}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>จากทุกลิงก์ในระบบ</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1a171a] p-5 rounded-[24px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2 hover:border-[#5c0620]/30 transition-all">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">ลิงก์ทั้งหมด</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                      <Link2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{links.length}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">รายการในพอร์ทัล</div>
                </div>

                <div className="bg-white dark:bg-[#1a171a] p-5 rounded-[24px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2 hover:border-[#5c0620]/30 transition-all">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">เฉพาะบุคลากร</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-[#5c0620] dark:text-rose-300 flex items-center justify-center">
                      <Briefcase className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-[#5c0620] dark:text-rose-400 tracking-tight">{staffLinksCount}</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">ระบบภายในต้องใช้รหัส</div>
                </div>

                <div className="bg-white dark:bg-[#1a171a] p-5 rounded-[24px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2 hover:border-[#5c0620]/30 transition-all">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">นักศึกษา / ทั่วไป</span>
                    <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-sky-900 dark:text-sky-300 tracking-tight">{studentLinksCount + bothLinksCount}</div>
                  <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">นักศึกษา {studentLinksCount} · ทั้งสอง {bothLinksCount}</div>
                </div>
              </div>

              {/* Bento Deep-Dive: Side-by-side Chart and Live Activity Table */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left: Top 10 Chart Bento Card */}
                <div className="xl:col-span-5 bg-white dark:bg-[#1a171a] p-6 rounded-[28px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        10 อันดับระบบยอดนิยม
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Top Visited Systems ตามสถิติคลิกเข้าชม</p>
                    </div>
                  </div>
                  {topLinksData.length > 0 && topLinksData[0].clicks > 0 ? (
                    <div className="h-[340px] w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topLinksData} layout="vertical" margin={{ top: 5, right: 25, left: 5, bottom: 5 }}>
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#94a3b8" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e1b1e', borderColor: '#332d33', borderRadius: '16px', color: '#fff' }}
                            formatter={(value) => [`${value} ครั้ง`, "จำนวนคลิก"]}
                            labelFormatter={(label, payload) => {
                              if (payload && payload.length > 0) {
                                return payload[0].payload.fullTitle;
                              }
                              return label;
                            }}
                          />
                          <Bar dataKey="clicks" fill="#e11d48" radius={[0, 8, 8, 0]} barSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-24 text-center text-slate-400 space-y-2">
                      <BarChart3 className="w-10 h-10 mx-auto opacity-30" />
                      <p className="text-sm font-medium">ยังไม่มีข้อมูลสถิติการคลิก</p>
                    </div>
                  )}
                </div>

                {/* Right: Real-time Live Table Bento Card */}
                <div className="xl:col-span-7 bg-white dark:bg-[#1a171a] p-6 rounded-[28px] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">ตารางสถิติเรียลไทม์ (Live Table)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">เรียงตามยอดเข้าชมจากมากไปน้อย</p>
                      </div>
                    </div>
                    
                    {/* Search and Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input 
                        type="text"
                        placeholder="ค้นหาระบบ..."
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 font-medium"
                      />
                      <select
                        value={dashboardCategoryFilter}
                        onChange={(e) => setDashboardCategoryFilter(e.target.value as any)}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252125] focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-slate-700 dark:text-slate-200 font-semibold"
                      >
                        <option value="all">ทุกหมวดหมู่</option>
                        <option value="university">🏛️ มหาวิทยาลัย</option>
                        <option value="faculty">🔬 คณะวิทย์ฯ</option>
                      </select>
                      <select
                        value={dashboardAudienceFilter}
                        onChange={(e) => setDashboardAudienceFilter(e.target.value as any)}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252125] focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-slate-700 dark:text-slate-200 font-semibold"
                      >
                        <option value="all">ทุกลิงก์ ({links.length})</option>
                        <option value="staff">เฉพาะบุคลากร ({staffLinksCount})</option>
                        <option value="student">เฉพาะนักศึกษา ({studentLinksCount})</option>
                        <option value="both">ทั้ง 2 กลุ่ม ({bothLinksCount})</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/80 dark:border-white/10">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3">ระบบ / ลิงก์</th>
                          <th className="p-3 w-28">หมวดหมู่</th>
                          <th className="p-3 w-28">กลุ่มเป้าหมาย</th>
                          <th className="p-3 w-32 text-right">ยอดเข้าชม</th>
                          <th className="p-3 w-28 text-right">สัดส่วน (% Share)</th>
                          <th className="p-3 w-16 text-center">เปิด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {dashboardFilteredLinks.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              ไม่พบข้อมูลลิงก์ที่ตรงกับเงื่อนไขค้นหา
                            </td>
                          </tr>
                        ) : (
                          dashboardFilteredLinks.map((link, idx) => {
                            const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');
                            const cat = link.category || 'faculty';
                            const clickShare = totalClicks > 0 ? Math.round(((link.clickCount || 0) / totalClicks) * 100) : 0;
                            return (
                              <tr key={link.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                                <td className="p-3 text-center font-bold text-slate-400">
                                  {idx < 3 ? (
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-bold ${
                                      idx === 0 ? "bg-amber-500 shadow-xs" : idx === 1 ? "bg-slate-400" : "bg-amber-700"
                                    }`}>
                                      {idx + 1}
                                    </span>
                                  ) : (
                                    idx + 1
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-slate-800 dark:text-white line-clamp-1">{link.title}</div>
                                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-xs">{link.url}</div>
                                </td>
                                <td className="p-3">
                                  {cat === 'university' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 px-2 py-0.5 rounded-full">
                                      <Building2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                      มหาวิทยาลัย
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 px-2 py-0.5 rounded-full">
                                      <FlaskConical className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      คณะวิทย์ฯ
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {aud === 'staff' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 px-2 py-0.5 rounded-full">
                                      <Briefcase className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                      เฉพาะบุคลากร
                                    </span>
                                  ) : aud === 'student' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 px-2 py-0.5 rounded-full">
                                      <GraduationCap className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                      เฉพาะนักศึกษา
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                                      <Users className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                      ทั้ง 2 กลุ่ม
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                    {(link.clickCount || 0).toLocaleString()}
                                  </span>
                                  <span className="text-slate-400 text-[11px] ml-1">ครั้ง</span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className="bg-[#5c0620] dark:bg-rose-600 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${Math.min(100, Math.max(4, clickShare))}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 w-8">{clickShare}%</span>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 inline-flex text-slate-400 hover:text-[#5c0620] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                                    title="เปิดลิงก์"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: MANAGE LINKS (Independent Dual-Column Scroll) */}
          {activeTab === "links" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-stretch xl:h-full xl:min-h-0 flex-1">
              
              {/* Left Column: Bento Card - Add / Edit Link Form (Compact, Ergonomic & Independent Scroll) */}
              <div className="xl:col-span-5 xl:h-full xl:min-h-0 flex flex-col">
                {currentUser?.role === "superadmin" ? (
                  <div id="link-form" className="bg-white dark:bg-[#1a171a] p-5 sm:p-6 rounded-[28px] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col xl:h-full xl:min-h-0">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                            {editingLinkId ? "แก้ไขข้อมูลลิงก์" : "เพิ่มลิงก์แนะนำใหม่"}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {editingLinkId ? "แก้ไขรายละเอียดแล้วกดบันทึก" : "กรอกข้อมูลและตั้งค่าลิงก์เข้าสู่พอร์ทัล"}
                          </p>
                        </div>
                      </div>

                      {editingLinkId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLinkId(null);
                            setLinkTitle("");
                            setLinkUrl("");
                            setLinkDesc("");
                            setLinkIsStaffOnly(false);
                            setLinkTargetAudience('both');
                            setLinkThumbnailUrl("");
                          }}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          ยกเลิกแก้ไข
                        </button>
                      )}
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleLinkSubmit} className="flex-1 xl:overflow-y-auto xl:min-h-0 pr-1 space-y-3.5 pt-3">
                      {/* Row 1: Title & URL */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>ชื่อระบบ / หัวข้อลิงก์ <span className="text-rose-500">*</span></span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="เช่น ระบบบริการการศึกษา (REG)"
                            value={linkTitle}
                            onChange={(e) => setLinkTitle(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-xs sm:text-sm font-semibold transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>ที่อยู่เว็บไซต์ (URL) <span className="text-rose-500">*</span></span>
                          </label>
                          <input
                            type="url"
                            required
                            placeholder="เช่น https://reg.ftu.ac.th"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-xs sm:text-sm font-mono transition-all"
                          />
                        </div>
                      </div>

                      {/* Row 2: Category & Target Audience */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Category */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            หมวดหมู่ <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#252125] rounded-xl border border-slate-200/60 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => setLinkCategory('university')}
                              className={`py-1.5 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                linkCategory === 'university'
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">มหาลัย</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLinkCategory('faculty')}
                              className={`py-1.5 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                linkCategory === 'faculty'
                                  ? 'bg-[#5c0620] text-white shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">คณะวิทย์ฯ</span>
                            </button>
                          </div>
                        </div>

                        {/* Audience */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            กลุ่มเป้าหมาย <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#252125] rounded-xl border border-slate-200/60 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => {
                                setLinkTargetAudience('both');
                                setLinkIsStaffOnly(false);
                              }}
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                linkTargetAudience === 'both'
                                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="ทั้ง 2 กลุ่ม (นักศึกษา & บุคลากร)"
                            >
                              <Users className="w-3 h-3 shrink-0" />
                              <span>ทุกคน</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setLinkTargetAudience('student');
                                setLinkIsStaffOnly(false);
                              }}
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                linkTargetAudience === 'student'
                                  ? 'bg-sky-600 text-white shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="เฉพาะนักศึกษา (ซ่อนจากบุคลากร)"
                            >
                              <GraduationCap className="w-3 h-3 shrink-0" />
                              <span>นศ.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setLinkTargetAudience('staff');
                                setLinkIsStaffOnly(true);
                              }}
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                linkTargetAudience === 'staff'
                                  ? 'bg-[#5c0620] text-white shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="เฉพาะบุคลากร (ซ่อนจากนักศึกษา)"
                            >
                              <Briefcase className="w-3 h-3 shrink-0" />
                              <span>บุคลากร</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Compact Image Uploader & Thumbnail Preview + Inline Pin to Top */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <FileImage className="w-3.5 h-3.5 text-[#5c0620] dark:text-rose-400" />
                            <span>รูปภาพประกอบลิงก์ (Thumbnail)</span>
                          </label>

                          {/* Pin & Maintenance Checkbox Inline */}
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                              <input
                                type="checkbox"
                                checked={linkIsPinned}
                                onChange={(e) => setLinkIsPinned(e.target.checked)}
                                className="w-3.5 h-3.5 text-[#5c0620] rounded border-slate-300 cursor-pointer"
                              />
                              <span className="flex items-center gap-1 text-[11px] font-bold">
                                <Pin className="w-3 h-3 text-rose-500" />
                                ปักหมุดบนสุด
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-800 dark:text-amber-300 select-none">
                              <input
                                type="checkbox"
                                checked={linkIsMaintenance}
                                onChange={(e) => setLinkIsMaintenance(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 cursor-pointer"
                              />
                              <span className="flex items-center gap-1 text-[11px] font-bold">
                                <Wrench className="w-3 h-3 text-amber-600" />
                                ปิดปรับปรุง
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Hidden File Input */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              await handleImageFile(e.target.files[0]);
                            }
                          }}
                          accept="image/*"
                          className="hidden"
                        />

                        {/* Compact Drop & Upload Bar */}
                        <div
                          onDragOver={handleImageDragOver}
                          onDragLeave={handleImageDragLeave}
                          onDrop={handleImageDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`min-h-[58px] px-3.5 py-2 rounded-xl border border-dashed flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isDragging
                              ? "border-[#5c0620] bg-rose-50/70 dark:bg-rose-950/40"
                              : linkThumbnailUrl
                              ? "border-slate-300 dark:border-white/20 bg-slate-50/50 dark:bg-[#252125]"
                              : "border-slate-300 dark:border-white/10 hover:border-[#5c0620] bg-slate-50/30 dark:bg-[#252125]"
                          }`}
                        >
                          {isProcessingImage ? (
                            <div className="flex items-center gap-2 mx-auto text-xs text-slate-500 font-bold">
                              <RefreshCw className="w-4 h-4 animate-spin text-[#5c0620] dark:text-rose-400" />
                              <span>กำลังประมวลผลรูป...</span>
                            </div>
                          ) : linkThumbnailUrl ? (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={linkThumbnailUrl}
                                  alt="Preview"
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-9 object-cover rounded-lg border border-slate-200 dark:border-white/10 shadow-2xs shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">
                                    มีรูปภาพประกอบแล้ว
                                  </span>
                                  <span className="text-[10px] text-slate-400">คลิกเปลี่ยนรูป หรือกด Ctrl+V วางใหม่</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkThumbnailUrl("");
                                }}
                                className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 transition-colors cursor-pointer"
                                title="ลบภาพประกอบ"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-2">
                                <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>คลิกเลือกรูปภาพ หรือลากวาง</span>
                                <span className="text-[10px] font-mono bg-white dark:bg-black/30 px-1 py-0.5 rounded border border-slate-200 dark:border-white/10 hidden sm:inline">Ctrl+V</span>
                              </div>
                              <span className="text-[10px] text-slate-400">16:10</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Description */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          คำอธิบายย่อ (ไม่บังคับ)
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น สำหรับลงทะเบียนเรียน เพิ่ม-ถอนรายวิชา และตรวจผลการเรียน"
                          value={linkDesc}
                          onChange={(e) => setLinkDesc(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-xs transition-all"
                        />
                      </div>

                      {/* Maintenance Note (when linkIsMaintenance is checked) */}
                      {linkIsMaintenance && (
                        <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-1">
                          <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>ข้อความแจ้งเตือนขณะปิดปรับปรุง (ไม่บังคับ)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="เช่น ปิดปรับปรุงระบบ 13:00 - 15:00 น. หรือ ขออภัยในความไม่สะดวก"
                            value={linkMaintenanceNote}
                            onChange={(e) => setLinkMaintenanceNote(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1f1a1c] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-xs transition-all"
                          />
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-1.5 pb-1">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full min-h-[44px] bg-[#5c0620] hover:bg-[#780829] active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-[#5c0620]/20 disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>{editingLinkId ? "บันทึกการแก้ไขลิงก์" : "เพิ่มลิงก์เข้าสู่ระบบ"}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-6 rounded-[28px] border border-amber-200/80 dark:border-amber-800/40 text-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto opacity-75" />
                    <h3 className="font-bold text-amber-800 dark:text-amber-300">ไม่มีสิทธิ์เพิ่มหรือแก้ไขลิงก์ในระบบส่วนกลาง</h3>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">บัญชีระดับ Admin สามารถจัดการการ <strong>"ปักหมุดส่วนตัว"</strong> ในตารางด้านขวาได้เท่านั้น</p>
                  </div>
                )}
              </div>

              {/* Right Column: Bento Card - Existing Links List (Independent Scroll) */}
              <div className="xl:col-span-7 xl:h-full xl:min-h-0 flex flex-col">
                <div className="bg-white dark:bg-[#1a171a] p-5 sm:p-6 rounded-[28px] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col xl:h-full xl:min-h-0">
                  
                  {/* List Header & Controls (shrink-0) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                          <span>รายการลิงก์ในระบบทั้งหมด</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 rounded-full font-mono">
                            {orderedLinks.length}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ลำดับที่แสดงตรงนี้คือลำดับจริงที่แสดงผลบนหน้าแรก
                        </p>
                      </div>
                    </div>

                    {/* Search & Category filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="ค้นหาลิงก์..."
                          value={linksTabSearch}
                          onChange={(e) => setLinksTabSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 font-medium"
                        />
                      </div>
                      
                      <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl gap-0.5 border border-slate-200/60 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setLinksTabCategory("all")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            linksTabCategory === "all" ? "bg-white dark:bg-[#252125] text-slate-900 dark:text-white shadow-2xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                          }`}
                        >
                          ทั้งหมด
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinksTabCategory("faculty")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            linksTabCategory === "faculty" ? "bg-white dark:bg-[#252125] text-[#5c0620] dark:text-rose-400 shadow-2xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                          }`}
                        >
                          คณะวิทย์ฯ
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinksTabCategory("university")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            linksTabCategory === "university" ? "bg-white dark:bg-[#252125] text-indigo-600 dark:text-indigo-400 shadow-2xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                          }`}
                        >
                          มหาวิทยาลัย
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reordering Guide Bar (shrink-0) */}
                  <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium flex-wrap gap-2 shrink-0 my-1">
                    <span className="flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span><strong>วิธีจัดลำดับ:</strong> ลากสลับตำแหน่งที่ปุ่ม <strong>⠿</strong> หรือกดปุ่ม <strong>⬆️ ⬇️</strong> เพื่อเลื่อนขึ้น/ลง</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                      Auto-sync
                    </span>
                  </div>

                  {/* Independent Scrollable Links List */}
                  <div className="flex-1 xl:overflow-y-auto xl:min-h-0 pr-1 pt-1 space-y-2.5 pb-4">
                    {displayedOrderedLinks.length === 0 ? (
                      <div className="bg-white dark:bg-[#1a171a] p-12 text-center text-slate-400 rounded-3xl border border-slate-200/80 dark:border-white/10 space-y-2">
                        <Info className="w-8 h-8 mx-auto opacity-40" />
                        <p className="text-sm font-semibold">ไม่พบรายการลิงก์ที่ตรงกับคำค้นหาหรือเงื่อนไข</p>
                      </div>
                    ) : (
                      displayedOrderedLinks.map((link) => {
                        const originalIndex = orderedLinks.findIndex(l => l.id === link.id);
                        const isFirst = originalIndex === 0;
                        const isLast = originalIndex === orderedLinks.length - 1;
                        const isBeingDragged = draggedIndex === originalIndex;
                        const isTargetDrag = dragOverIndex === originalIndex;
                        const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');
                        const cat = link.category || 'faculty';

                        return (
                          <div
                            key={link.id}
                            onDragOver={(e) => handleLinkDragOver(e, originalIndex)}
                            onDrop={(e) => handleLinkDrop(e, originalIndex)}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                              isBeingDragged
                                ? "opacity-30 bg-slate-100 dark:bg-white/10 border-dashed border-slate-300"
                                : isTargetDrag
                                ? "border-2 border-[#5c0620] dark:border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 shadow-md scale-[1.01]"
                                : "bg-white dark:bg-[#1e1b1e] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs"
                            }`}
                          >
                            {/* Left & Middle Info */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Drag Handle */}
                              {currentUser?.role === "superadmin" && (
                                <div
                                  draggable
                                  onDragStart={(e) => handleLinkDragStart(e, originalIndex)}
                                  onDragEnd={handleLinkDragEnd}
                                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors shrink-0 select-none"
                                  title="คลิกค้างแล้วลากเพื่อสลับลำดับ"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              )}

                              {/* Order Number Badge */}
                              <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                #{originalIndex + 1}
                              </span>

                              {/* Thumbnail preview */}
                              <div className="w-12 h-10 rounded-xl bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0 border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                <img 
                                  src={link.thumbnailUrl || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=100&auto=format&fit=crop"} 
                                  alt="" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Title & Clear Metadata Row */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-snug truncate">
                                    {link.title}
                                  </h5>
                                  {link.isPinned && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0">
                                      📌 ปักหมุด
                                    </span>
                                  )}
                                  {link.isMaintenance && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-1">
                                      <Wrench className="w-2.5 h-2.5" />
                                      ปิดปรับปรุง
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Category Pill */}
                                  {cat === 'university' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-full inline-flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/40">
                                      <Building2 className="w-2.5 h-2.5" />
                                      มหาลัย
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-full inline-flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-800/40">
                                      <FlaskConical className="w-2.5 h-2.5" />
                                      คณะวิทย์ฯ
                                    </span>
                                  )}

                                  {/* Audience Pill */}
                                  {aud === 'staff' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-[#5c0620] dark:bg-rose-700 rounded-full inline-flex items-center gap-1">
                                      <Briefcase className="w-2.5 h-2.5" />
                                      บุคลากร
                                    </span>
                                  ) : aud === 'student' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-sky-600 rounded-full inline-flex items-center gap-1">
                                      <GraduationCap className="w-2.5 h-2.5" />
                                      นักศึกษา
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 rounded-full inline-flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5 text-slate-500" />
                                      ทุกคน
                                    </span>
                                  )}

                                  {/* Click Count */}
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    · {link.clickCount || 0} คลิก
                                  </span>

                                  {/* URL */}
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[160px] sm:max-w-xs hidden lg:inline-block">
                                    · {link.url}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Reorder & Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5 w-full md:w-auto justify-end">
                              {/* Up / Down Buttons */}
                              {currentUser?.role === "superadmin" && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200/60 dark:border-white/10 mr-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLink(originalIndex, originalIndex - 1)}
                                    disabled={isFirst || isSavingOrder}
                                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                    title="เลื่อนขึ้น 1 อันดับ"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLink(originalIndex, originalIndex + 1)}
                                    disabled={isLast || isSavingOrder}
                                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                    title="เลื่อนลง 1 อันดับ"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Maintenance Quick Toggle Button */}
                              {currentUser?.role === "superadmin" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const nextState = !link.isMaintenance;
                                    await onUpdateLink(link.id, { isMaintenance: nextState });
                                    showAlert(`เปลี่ยนสถานะ "${link.title}" เป็น ${nextState ? "ปิดปรับปรุงชั่วคราว" : "เปิดใช้งานปกติ"}`);
                                  }}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                    link.isMaintenance
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs"
                                      : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200/60 dark:border-white/10"
                                  }`}
                                  title={link.isMaintenance ? "กำลังปิดปรับปรุง (คลิกเพื่อเปิดให้บริการตามปกติ)" : "เปิดให้บริการปกติ (คลิกเพื่อตั้งเป็นปิดปรับปรุง)"}
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Pin Button */}
                              <button
                                type="button"
                                onClick={() => togglePinStatus(link)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                  (currentUser?.role === "superadmin" ? link.isPinned : currentUser?.pinnedLinks?.includes(link.id))
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs" 
                                    : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200/60 dark:border-white/10"
                                }`}
                                title={(currentUser?.role === "superadmin" ? link.isPinned : currentUser?.pinnedLinks?.includes(link.id)) ? "ยกเลิกปักหมุด" : "ปักหมุดไว้บนสุด"}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              
                              {currentUser?.role === "superadmin" && (
                                <>
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      startEditLink(link);
                                      document.getElementById("link-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/70 dark:border-amber-800/50 transition-all cursor-pointer shadow-2xs"
                                    title="แก้ไขข้อมูลลิงก์"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => setLinkToDelete({ id: link.id, title: link.title })}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/70 dark:border-rose-800/50 transition-all cursor-pointer shadow-2xs"
                                    title="ลบลิงก์"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: STAFF MANAGEMENT */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              {/* Header Overview Card */}
              <div className="bg-gradient-to-r from-slate-900 via-[#5c0620] to-[#3a0210] text-white p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <span>จัดการบัญชีและรหัสผ่านบุคลากร</span>
                        <span className="text-xs bg-rose-500/30 text-rose-200 border border-rose-300/30 px-2.5 py-0.5 rounded-full font-normal">
                          Staff Accounts
                        </span>
                      </h3>
                      <p className="text-xs text-rose-100/80 mt-0.5">
                        กำหนดชื่อบัญชี/ชื่อบุคลากร พร้อมรหัสผ่านสำหรับเข้าใช้งานระบบ
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto">
                    <Users className="w-4 h-4 text-rose-300" />
                    <span className="text-xs text-rose-100">จำนวนบัญชีในระบบ:</span>
                    <span className="text-sm font-bold text-white font-mono">{staffPasswordItems.length} บัญชี</span>
                  </div>
                </div>

                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-xs text-rose-100/90 leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">คำอธิบายการทำงาน:</strong> เมื่อระบุ <strong>"ชื่อบัญชี/ชื่อบุคลากร"</strong> และ <strong>"รหัสผ่าน"</strong> แล้ว บุคลากรจะสามารถล็อกอินที่หน้าเว็บด้วย<strong>รหัสผ่านเพียงอย่างเดียว</strong> (ไม่ต้องกรอก Username) ระบบจะระบุตัวตนและแสดงชื่อบัญชีนั้นบนแถบโหมดบุคลากรโดยอัตโนมัติ พร้อมซ่อนลิงก์เฉพาะนักศึกษาทันที
                  </div>
                </div>
              </div>

              {/* Form to Add New Staff Account & Password */}
              <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                  <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-base">
                      เพิ่มบัญชีและกำหนดรหัสผ่านบุคลากร (Add Staff Account & Password)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      กรอกชื่อบุคลากรหรือแผนก พร้อมกำหนดรหัสผ่านเข้าใช้งาน
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddStaffPassword} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Field 1: Staff Account Name */}
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        ชื่อบัญชี / ชื่อบุคลากร <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น อ.สมชาย ใจดี หรือ งานวิชาการ"
                        value={newStaffPasswordLabel}
                        onChange={(e) => setNewStaffPasswordLabel(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 dark:focus:ring-rose-500/30 focus:border-[#5c0620] dark:focus:border-rose-500 text-sm bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                      />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                        ชื่อนี้จะถูกแสดงเมื่อเข้าใช้งาน
                      </span>
                    </div>

                    {/* Field 2: Password */}
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        รหัสผ่านเข้าใช้งาน (Password) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="เช่น sci2025 หรือ staff1234"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 dark:focus:ring-rose-500/30 focus:border-[#5c0620] dark:focus:border-rose-500 text-sm font-mono bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateRandomStaffCode}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="สุ่มรหัสผ่านอัตโนมัติ"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>สุ่มรหัส</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                        รหัสสำหรับปลดล็อกโหมดบุคลากร
                      </span>
                    </div>

                    {/* Field 3: Department / Note */}
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        สาขาวิชา / ฝ่ายงาน (ระบุหรือไม่ก็ได้)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น สาขาวิชาวิทยาการคอมพิวเตอร์"
                        value={newStaffDepartment}
                        onChange={(e) => setNewStaffDepartment(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 dark:focus:ring-rose-500/30 focus:border-[#5c0620] dark:focus:border-rose-500 text-sm bg-slate-50/50 dark:bg-[#252125] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                      />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                        ข้อมูลสังกัดสำหรับจัดกลุ่ม
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newStaffPassword.trim() || !newStaffPasswordLabel.trim()}
                      className="px-6 py-2.5 bg-[#5c0620] hover:bg-rose-950 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-[#5c0620]/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>บันทึกบัญชีบุคลากร</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* List of Staff Accounts */}
              <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-[#5c0620] dark:bg-rose-600 rounded-full"></div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">
                        รายชื่อบัญชีและรหัสผ่านบุคลากร ({staffPasswordItems.length} บัญชี)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        บัญชีที่สามารถใช้รหัสผ่านเข้าใช้งานโหมดบุคลากรได้ทันที
                      </p>
                    </div>
                  </div>

                  {/* Search filter for staff */}
                  {staffPasswordItems.length > 0 && (
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อบัญชี, รหัสผ่าน..."
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] bg-slate-50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400"
                      />
                    </div>
                  )}
                </div>

                {staffPasswordItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#5c0620] dark:text-rose-300 flex items-center justify-center mx-auto">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">ยังไม่มีบัญชีบุคลากรในระบบ</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        กรุณาเพิ่มชื่อบัญชีและรหัสผ่านในแบบฟอร์มด้านบนเพื่อให้บุคลากรใช้เข้าดูระบบเฉพาะบุคลากรได้
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {staffPasswordItems
                      .filter(item => {
                        if (!staffSearchQuery.trim()) return true;
                        const q = staffSearchQuery.toLowerCase();
                        return (
                          item.label.toLowerCase().includes(q) ||
                          item.code.toLowerCase().includes(q) ||
                          (item.department && item.department.toLowerCase().includes(q))
                        );
                      })
                      .map((item) => {
                        const isPasswordVisible = !!showPasswordIds[item.id];
                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#252125] hover:border-[#5c0620]/30 dark:hover:border-rose-500/30 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#5c0620] dark:text-rose-300 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center font-bold text-sm shrink-0">
                                {item.label.charAt(0) || "บุ"}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-800 dark:text-white">
                                    {item.label}
                                  </span>
                                  {item.department && (
                                    <span className="text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 px-2.5 py-0.5 rounded-full">
                                      {item.department}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 flex-wrap">
                                  <span>สร้างเมื่อ: {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : "ไม่ระบุ"}</span>
                                  {item.createdBy && <span>· โดย {item.createdBy}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                              {/* Password Display Box with Toggle */}
                              <div className="flex items-center bg-slate-100 dark:bg-[#1a171a] rounded-xl px-3 py-1.5 border border-slate-200 dark:border-white/10 gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">รหัสผ่าน:</span>
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-white tracking-wider">
                                  {isPasswordVisible ? item.code : "••••••••"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleShowPassword(item.id)}
                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-md transition-colors cursor-pointer"
                                  title={isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                                >
                                  {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              {/* Copy Button */}
                              <button
                                type="button"
                                onClick={() => handleCopyCode(item.id, item.code)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                  copiedCodeId === item.id
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                                    : "bg-white dark:bg-[#1e1b1e] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#252125]"
                                }`}
                              >
                                {copiedCodeId === item.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>คัดลอกแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    <span>คัดลอกรหัส</span>
                                  </>
                                )}
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveStaffPassword(item)}
                                disabled={isSubmitting}
                                className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40"
                                title="ลบบัญชีนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: GOOGLE SHEETS */}
          {activeTab === "sheets" && (
            <div className="space-y-6">
              {/* Header Overview Banner */}
              <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-emerald-300">
                    <Grid className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <span>เชื่อมต่อและจัดการข้อมูลผ่าน Google Sheets</span>
                      <span className="text-xs bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-normal">
                        Realtime Database
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-100/80 mt-0.5">
                      บันทึกข้อมูลลิงก์ โลโก้ และประกาศไปยัง Google Sheets ผ่าน Web App Script แบบอัตโนมัติ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto">
                  <div className={`w-2.5 h-2.5 rounded-full ${adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-xs text-emerald-100">สถานะ:</span>
                  <span className="text-xs font-bold text-white">
                    {adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl ? "เชื่อมต่อเรียลไทม์" : "ไม่ได้เปิดการซิงค์"}
                  </span>
                </div>
              </div>

              {/* Bento 2-Column Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left Bento: Connection & Actions */}
                <div className="xl:col-span-6 space-y-6">
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-emerald-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          การตั้งค่าการเชื่อมต่อ (Sync Settings)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          กำหนด URL และรอบเวลาการอัปเดตข้อมูลกับ Google Sheets
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Sync Toggle */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          เปิดใช้งานการซิงค์ข้อมูลกับ Google Sheets
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-4 border rounded-2xl transition-all ${
                          adminConfig.isGoogleSheetSyncEnabled 
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' 
                            : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}>
                          <input
                            type="checkbox"
                            checked={adminConfig.isGoogleSheetSyncEnabled || false}
                            onChange={(e) => onUpdateConfig({ isGoogleSheetSyncEnabled: e.target.checked })}
                            className="w-5 h-5 text-emerald-600 rounded-lg border-slate-300 dark:border-white/20 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="text-sm font-bold text-slate-800 dark:text-white block">
                              เปิดการซิงค์ข้อมูลอัตโนมัติ
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              เมื่อเปิดใช้งาน ลิงก์ที่เพิ่มหรือแก้ไขจะถูกส่งไปยัง Google Sheets ทันที
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Web App URL */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Google Apps Script Web App URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://script.google.com/macros/s/.../exec"
                          value={adminConfig.googleAppsScriptUrl || ""}
                          onChange={(e) => onUpdateConfig({ googleAppsScriptUrl: e.target.value })}
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-mono transition-colors"
                        />
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                          URL ที่ได้จากการ Deploy Web App บน Google Apps Script
                        </span>
                      </div>
                      
                      {/* Interval */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          ความถี่ในการดึงข้อมูลอัปเดต (วินาที)
                        </label>
                        <input
                          type="number"
                          min="5"
                          placeholder="10"
                          value={adminConfig.syncInterval || 5}
                          onChange={(e) => onUpdateConfig({ syncInterval: parseInt(e.target.value, 10) || 5 })}
                          className="w-full max-w-[160px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono transition-colors"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 space-y-3">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setIsSubmitting(true);
                              if (!adminConfig.googleAppsScriptUrl) {
                                showAlert("กรุณาระบุ Web App URL ก่อน", "error");
                                return;
                              }
                              const { syncAllViaWebApp } = await import('../googleSheets');
                              const adminUsers = JSON.parse(localStorage.getItem("scitech_admin_users") || "[]");
                              await syncAllViaWebApp(
                                adminConfig.googleAppsScriptUrl,
                                links,
                                {
                                  siteTitle: adminConfig.siteTitle || "",
                                  siteLogoUrl: adminConfig.siteLogoUrl || "",
                                  announcementText: adminConfig.announcementText || "",
                                  isAnnouncementActive: adminConfig.isAnnouncementActive ? "true" : "false",
                                },
                                adminUsers
                              );
                              showAlert("✅ ซิงค์ข้อมูลทั้งหมด (ลิงก์, ข้อมูลเว็บ, ประกาศ) ไปยัง Google Sheets สำเร็จเรียบร้อย!");
                            } catch (err: any) {
                              showAlert("การซิงค์ข้อมูลเกิดข้อผิดพลาด: " + (err?.message || "ตรวจสอบ URL"), "error");
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          disabled={isSubmitting}
                          className="w-full min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>ซิงค์ข้อมูลทั้งหมดไปยัง Google Sheets ทันที</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setIsSubmitting(true);
                              if (!adminConfig.googleAppsScriptUrl) {
                                showAlert("กรุณาระบุ Web App URL ก่อน", "error");
                                return;
                              }
                              const { fetchFromWebApp } = await import('../googleSheets');
                              const res = await fetchFromWebApp(adminConfig.googleAppsScriptUrl);
                              if (res.success && res.data) {
                                localStorage.setItem("scitech_links", JSON.stringify(res.data));
                                if (res.settings) {
                                  const updatedCfg = { ...adminConfig };
                                  if (res.settings.siteTitle) updatedCfg.siteTitle = res.settings.siteTitle;
                                  if (res.settings.siteLogoUrl) updatedCfg.siteLogoUrl = res.settings.siteLogoUrl;
                                  if (res.settings.announcementText !== undefined) updatedCfg.announcementText = res.settings.announcementText;
                                  if (res.settings.isAnnouncementActive !== undefined) {
                                    updatedCfg.isAnnouncementActive = res.settings.isAnnouncementActive === true || res.settings.isAnnouncementActive === "true";
                                  }
                                  await onUpdateConfig(updatedCfg);
                                }
                                showAlert(`✅ ดึงข้อมูลสำเร็จ! พบข้อมูลลิงก์ทั้งหมด ${res.data.length} รายการ (กำลังรีเฟรช...)`);
                                setTimeout(() => window.location.reload(), 1200);
                              } else {
                                showAlert("ดึงข้อมูลไม่สำเร็จ: " + (res.error || "ไม่พบข้อมูลที่ถูกต้อง"), "error");
                              }
                            } catch (err: any) {
                              showAlert("ดึงข้อมูลไม่สำเร็จ: " + (err?.message || "โปรดตรวจสอบสิทธิ์ของ Web App"), "error");
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          disabled={isSubmitting}
                          className="w-full min-h-[48px] px-5 py-3 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>ดึงข้อมูลล่าสุดจาก Google Sheets มายังหน้านี้</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Bento: Setup Guide & Code */}
                <div className="xl:col-span-6 space-y-6">
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-teal-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          คู่มือติดตั้ง Google Apps Script (Setup Guide)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ขั้นตอนคัดลอกและเผยแพร่ Web App บน Google Sheets ของคุณ
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#252125] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                      <ol className="text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-2 leading-relaxed">
                        <li>เปิด Google Sheets ของคุณ ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong></li>
                        <li>คัดลอกโค้ดด้านล่างไปวางแทนที่ของเดิมใน Apps Script</li>
                        <li>กด <strong>การทำให้ใช้งานได้ (Deploy)</strong> &gt; <strong>การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong></li>
                        <li>เลือกประเภท <strong>เว็บแอป (Web app)</strong></li>
                        <li>ตั้งค่า <strong>ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)</strong> และกด <strong>ทำให้ใช้งานได้</strong></li>
                        <li>คัดลอก <strong>URL ของเว็บแอป</strong> มาใส่ในช่องฝั่งซ้ายมือ</li>
                      </ol>

                      <div className="relative pt-2">
                        <textarea
                          readOnly
                          className="w-full h-56 p-3 text-[11px] font-mono text-slate-700 dark:text-emerald-300 bg-white dark:bg-[#161316] rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden resize-none leading-relaxed"
                          value={GAS_SCRIPT_TEMPLATE}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE);
                            showAlert("คัดลอกสคริปต์ Google Apps Script แล้ว");
                          }}
                          className="absolute top-4 right-3 px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอกโค้ด</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: SECURITY SETTINGS */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Header Overview Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-indigo-300">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <span>ตั้งค่าระบบ ความปลอดภัย และข้อมูลเว็บไซต์</span>
                      <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full font-normal">
                        Security & System
                      </span>
                    </h3>
                    <p className="text-xs text-indigo-100/80 mt-0.5">
                      จัดการชื่อเว็บไซต์ โลโก้ ข้อความประกาศด่วน รหัสผ่าน และการสำรองถ่ายโอนข้อมูล
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto text-xs text-indigo-100">
                  <Lock className="w-4 h-4 text-indigo-300" />
                  <span>เข้าสู่ระบบเป็น:</span>
                  <span className="font-bold text-white">{currentUser?.username}</span>
                </div>
              </div>

              {/* Bento 2-Column Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Column (xl:col-span-6) */}
                <div className="xl:col-span-6 space-y-6">
                  {/* Site Info Config */}
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-indigo-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          ข้อมูลเว็บไซต์ & โลโก้ (Site Info)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ตั้งชื่อและโลโก้ที่แสดงบนแท็บของเบราว์เซอร์
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSiteInfoSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          ชื่อเว็บไซต์ (Site Title)
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น ระบบพอร์ทัลลิงก์สำคัญ คณะวิทยาศาสตร์และเทคโนโลยี"
                          value={siteTitle}
                          onChange={(e) => setSiteTitle(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          โลโก้เว็บไซต์ (Favicon & Tab Icon)
                        </label>
                        <div className="flex gap-4 items-center">
                          {siteLogoUrl ? (
                            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-[#252125] border border-slate-200 dark:border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1.5 shadow-2xs">
                              <img src={siteLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#252125] border border-dashed border-slate-300 dark:border-white/20 shrink-0 flex items-center justify-center text-slate-400">
                              <Grid className="w-5 h-5 opacity-40" />
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder="วาง URL ของรูปภาพโลโก้ที่นี่"
                              value={siteLogoUrl}
                              onChange={(e) => setSiteLogoUrl(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-colors"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">หรืออัปโหลดไฟล์รูปภาพ:</span>
                              <label className="cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 px-3 py-1 rounded-lg transition-colors">
                                เลือกไฟล์รูปภาพ
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoFile}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>บันทึกข้อมูลเว็บไซต์</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Change Admin Password */}
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-amber-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          เปลี่ยนรหัสผ่านของคุณ ({currentUser?.username})
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          กำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบของบัญชีที่กำลังใช้งานอยู่
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleChangeMyPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          รหัสผ่านใหม่ (New Password)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            placeholder="กรอกรหัสผ่านใหม่..."
                            value={myNewPassword}
                            onChange={(e) => setMyNewPassword(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-mono transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={isSubmitting || !myNewPassword.trim()}
                            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-amber-600/20 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            {isSubmitting ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span>บันทึกรหัสใหม่</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right Column (xl:col-span-6) */}
                <div className="xl:col-span-6 space-y-6">
                  {/* Announcement Config */}
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-blue-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          ประกาศแจ้งเตือนด่วน (Announcement Banner)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          จัดการข้อความแจ้งเตือนที่แถบด้านบนสุดของเว็บไซต์
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          สถานะการแสดงผล
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-3.5 border rounded-2xl transition-all ${
                          isAnnouncementActive 
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800' 
                            : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isAnnouncementActive}
                            onChange={(e) => setIsAnnouncementActive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded-md border-slate-300 dark:border-white/20 focus:ring-blue-500"
                          />
                          <span className="text-sm font-bold text-slate-800 dark:text-white">
                            เปิดใช้งานแถบประกาศแจ้งเตือนบนหน้าเว็บ
                          </span>
                        </label>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          ข้อความประกาศแจ้งเตือน
                        </label>
                        <textarea
                          rows={3}
                          placeholder="เช่น ประกาศ: กำหนดการลงทะเบียนเรียนภาคการศึกษาถัดไป เริ่มวันที่ 1-5 ..."
                          value={announcementText}
                          onChange={(e) => setAnnouncementText(e.target.value)}
                          disabled={!isAnnouncementActive}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-white/5 transition-colors"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>บันทึกการตั้งค่าประกาศ</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Data Backup & Transfer Config (For Vercel / Cross-Domain Migration) */}
                  <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                      <div className="w-2.5 h-6 bg-emerald-500 rounded-full"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base">
                          สำรองและย้ายข้อมูลเว็บไซต์ (Backup & Transfer)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ส่งออกข้อมูลทุกลิงก์ โลโก้ และประกาศ เพื่อนำไปใช้บน Vercel หรือย้ายเครื่อง
                        </p>
                      </div>
                    </div>

                    {backupStatus && (
                      <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                        backupStatus.type === 'success' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' 
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                      }`}>
                        {backupStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                        <span>{backupStatus.message}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Export Box */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252125] border border-slate-200/80 dark:border-white/10 space-y-3">
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">1. ส่งออกข้อมูล (Export)</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          ดาวน์โหลดลิงก์ทั้งหมด ({links.length} ลิงก์) และการตั้งค่าเป็นไฟล์ JSON
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleExportBackup}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ดาวน์โหลด JSON</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyBackupJSON}
                            className="px-3 py-2 bg-white dark:bg-[#1a171a] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {isCopiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{isCopiedBackup ? "คัดลอกแล้ว" : "คัดลอก JSON"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Import Box */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252125] border border-slate-200/80 dark:border-white/10 space-y-3">
                        <div className="flex items-center gap-2">
                          <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">2. นำเข้าข้อมูล (Import)</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          นำเข้าไฟล์ JSON ที่สำรองไว้เพื่อเรียกคืนข้อมูลทั้งหมดทันที
                        </p>
                        <div className="pt-1">
                          <input
                            type="file"
                            ref={backupFileInputRef}
                            accept=".json,application/json"
                            onChange={handleImportBackup}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => backupFileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>เลือกไฟล์ JSON นำเข้า</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: ADMIN ACCOUNTS (SUPERADMIN ONLY) */}
          {activeTab === "admins" && (
            <div className="space-y-6">
              {/* Header Overview Banner */}
              <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-amber-300">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <span>จัดการบัญชีผู้ดูแลระบบ (Admin Accounts)</span>
                      <span className="text-xs bg-amber-500/30 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-normal">
                        Access Control
                      </span>
                    </h3>
                    <p className="text-xs text-amber-100/80 mt-0.5">
                      กำหนดชื่อผู้ใช้ รหัสผ่าน และบทบาทผู้ดูแลระบบ (สำหรับ Superadmin)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto text-xs text-amber-100">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>แอดมินทั้งหมด:</span>
                  <span className="font-bold text-white font-mono">{adminUsers.length} บัญชี</span>
                </div>
              </div>

              {currentUser?.role !== "superadmin" ? (
                <div className="p-12 text-center text-rose-500 bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-800/40 font-semibold flex flex-col items-center justify-center gap-3">
                  <ShieldAlert className="w-10 h-10 text-rose-600 dark:text-rose-400" />
                  <span className="text-base font-bold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</span>
                  <span className="text-xs text-rose-600/80 dark:text-rose-400/80">
                    ต้องใช้บัญชีสิทธิ์ Superadmin เท่านั้นในการจัดการบัญชีผู้ดูแลคนอื่น
                  </span>
                </div>
              ) : (
                /* Bento 2-Column Grid */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                  {/* Left Column: Add Admin Form */}
                  <div className="xl:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                        <div className="w-2.5 h-6 bg-amber-500 rounded-full"></div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-base">
                            เพิ่มบัญชีแอดมินใหม่ (Add Admin)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            กำหนด Username, Password และระดับสิทธิ์
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleAddAdmin} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={newAdminUsername}
                            onChange={(e) => setNewAdminUsername(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition-colors"
                            placeholder="เช่น admin_fahsai"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            รหัสผ่าน (Password) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            required
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-mono transition-colors"
                            placeholder="รหัสผ่านเข้าใช้งาน"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            บทบาทและสิทธิ์ (Role) <span className="text-rose-500">*</span>
                          </label>
                          <select 
                            value={newAdminRole}
                            onChange={(e) => setNewAdminRole(e.target.value as "admin" | "superadmin" | "staff")}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs transition-colors"
                          >
                            <option value="admin">Admin (ผู้ดูแลระบบ: ปักหมุดส่วนตัว, จัดการลิงก์)</option>
                            <option value="staff">บุคลากร (ล็อกอินปุ่ม &quot;บุคลากร&quot; ดูลิงก์เฉพาะบุคลากร)</option>
                            <option value="superadmin">Superadmin (ผู้ดูแลระบบสูงสุด: จัดการได้ทุกอย่าง)</option>
                          </select>
                        </div>

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isSubmitting || !newAdminUsername.trim() || !newAdminPassword.trim()}
                            className="w-full min-h-[46px] px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>บันทึกบัญชีผู้ดูแลระบบ</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Admin List */}
                  <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white dark:bg-[#1e1b1e] p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
                        <div className="w-2.5 h-6 bg-slate-700 dark:bg-slate-300 rounded-full"></div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-base">
                            รายชื่อแอดมินในระบบ ({adminUsers.length} บัญชี)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            บัญชีที่มีสิทธิ์เข้าจัดการหลังบ้าน
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {adminUsers.length > 0 ? (
                          adminUsers.map((admin, idx) => (
                            <div 
                              key={idx} 
                              className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#252125] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-300 dark:hover:border-amber-600/40 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{admin.username}</span>
                                  {admin.role === "superadmin" && (
                                    <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 dark:border-rose-800/40">
                                      Superadmin
                                    </span>
                                  )}
                                  {admin.role === "admin" && (
                                    <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full tracking-wider border border-amber-200 dark:border-amber-800/40">
                                      Admin
                                    </span>
                                  )}
                                  {admin.role === "staff" && (
                                    <span className="text-[10px] font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full tracking-wider">
                                      บุคลากร
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span>รหัสผ่าน:</span>
                                  <span className="font-mono bg-white dark:bg-[#1a171a] px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-semibold">
                                    {(admin as any).password || "••••••••"}
                                  </span> 
                                  <span className="text-[11px] opacity-70">(แอดมินหลักสามารถดูได้)</span>
                                </div>
                              </div>

                              {adminUsers.length > 1 ? (
                                <button 
                                  onClick={() => handleDeleteAdmin(admin.username)}
                                  className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 rounded-xl transition-colors cursor-pointer self-start sm:self-center shrink-0 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40"
                                  title={`ลบบัญชี ${admin.username}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span 
                                  className="text-[11px] text-slate-400 dark:text-slate-500 italic px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-lg shrink-0 self-start sm:self-center"
                                  title="สร้างแอดมินใหม่ทางซ้ายก่อน จึงจะสามารถลบบัญชีนี้ได้"
                                >
                                  บัญชีเดียวในระบบ
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-400 text-sm">
                            ยังไม่มีข้อมูลแอดมินในระบบ
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 border-t border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#181618] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Bento Studio Admin Workspace · FST Link Hub</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-2xl transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};

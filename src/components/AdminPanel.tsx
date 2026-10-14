import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, AdminConfig, User, AuthCredentials, StaffPasswordItem } from "../types";
import { 
  X, Save, Trash2, Edit2, Key, Info, FolderPlus, 
  Grid, Link2, CheckCircle2, AlertCircle, RefreshCw, Settings,
  Upload, FileImage, Pin, BarChart3, Bell, Plus, Users, ShieldAlert,
  Lock, Download, Copy, Check, FileJson, GraduationCap, Briefcase,
  ExternalLink, Eye, TrendingUp, Sparkles, BarChart2
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
}) => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "links" | "sheets" | "staff" | "security" | "admins">("dashboard");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Success / Error messages
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link Form State
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkCategory, setLinkCategory] = useState("");
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
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

  // Target Audience & Pin State
  const [linkTargetAudience, setLinkTargetAudience] = useState<"both" | "student" | "staff">("both");
  const [linkIsStaffOnly, setLinkIsStaffOnly] = useState(false);
  const [linkIsPinned, setLinkIsPinned] = useState(false);

  // Dashboard Real-time table filter & search
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardAudienceFilter, setDashboardAudienceFilter] = useState<"all" | "student" | "staff" | "both">("all");

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

    const defaultAdmin = {
      username: "admin",
      password: adminConfig.adminPassword || "admin1234",
      role: "superadmin" as const,
      pinnedLinks: []
    };
    setAdminUsers([defaultAdmin]);
    localStorage.setItem("scitech_admin_users", JSON.stringify([defaultAdmin]));
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
    if (!window.confirm(`ยืนยันการลบแอดมิน: ${username}?`)) return;
    
    setIsSubmitting(true);
    try {
       if (adminConfig.googleAppsScriptUrl && authCreds) {
         await deleteAdminViaWebApp(adminConfig.googleAppsScriptUrl, username, authCreds);
       }
       const updated = adminUsers.filter(a => a.username !== username);
       setAdminUsers(updated);
       localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
       showAlert(`ลบแอดมิน ${username} สำเร็จ`);
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
          isStaffOnly: isStaff,
          thumbnailUrl: linkThumbnailUrl,
          isPinned: linkIsPinned,
        });
        showAlert("อัปเดตลิงก์สำเร็จแล้ว");
        setEditingLinkId(null);
      } else {
        await onAddLink({
          title: linkTitle,
          url: linkUrl,
          description: linkDesc,
          targetAudience: targetAud,
          isStaffOnly: isStaff,
          thumbnailUrl: linkThumbnailUrl,
          isPinned: linkIsPinned,
        });
        showAlert("เพิ่มลิงก์ใหม่เรียบร้อยแล้ว");
      }
      // Reset state
      setLinkTitle("");
      setLinkUrl("");
      setLinkDesc("");
      setLinkTargetAudience("both");
      setLinkIsStaffOnly(false);
      setLinkIsPinned(false);
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
    if (!code) return;
    
    setIsSubmitting(true);
    try {
      const label = newStaffPasswordLabel.trim() || `รหัสบุคลากรชุดที่ ${staffPasswordItems.length + 1}`;
      const newItem: StaffPasswordItem = {
        id: `spw-${Date.now()}`,
        label,
        code,
        createdAt: new Date().toISOString()
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

      showAlert(`เพิ่มรหัสผ่านบุคลากร "${code}" เรียบร้อยแล้ว`);
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการเพิ่มรหัสผ่านบุคลากร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStaffPassword = async (passwordToRemove: string) => {
    setIsSubmitting(true);
    try {
      const updatedPasswords = staffPasswords.filter(p => p !== passwordToRemove);
      const updatedItems = staffPasswordItems.filter(i => i.code !== passwordToRemove);
      const { hashStaffCode } = await import('../staffCodes');
      const removedHash = await hashStaffCode(passwordToRemove);
      const updatedHashes = (adminConfig.staffCodeHashes || []).filter(h => h !== removedHash);

      setStaffPasswords(updatedPasswords);
      setStaffPasswordItems(updatedItems);

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

      showAlert("ลบรหัสผ่านสำหรับหมวดหมู่บุคลากรสำเร็จ");
    } catch (err) {
      showAlert("เกิดข้อผิดพลาดในการลบรหัสผ่านบุคลากร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateRandomStaffCode = () => {
    const prefixes = ["FST-STAFF", "SCI-TECH", "STAFF"];
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
    setLinkIsPinned(link.isPinned || false);
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
      if (dashboardSearch.trim()) {
        const q = dashboardSearch.toLowerCase();
        return link.title.toLowerCase().includes(q) || link.url.toLowerCase().includes(q) || (link.description && link.description.toLowerCase().includes(q));
      }
      return true;
    }).sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
  }, [links, dashboardAudienceFilter, dashboardSearch]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {linkToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 text-center">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600 text-center">
              คุณแน่ใจหรือไม่ที่จะลบลิงก์ <strong className="text-rose-600">"{linkToDelete.title}"</strong> ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLinkToDelete(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeDeleteLink}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-colors"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/50 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5c0620] text-white rounded-2xl shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">ระบบจัดการข้อมูลกลาง (Central Management)</h2>
              <p className="text-xs text-slate-500">จัดการข้อมูลลิงก์ หมวดหมู่ และระบบความปลอดภัยของคณะฯ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner & Alerts */}
        {message && (
          <div className={`px-6 py-3.5 flex items-center gap-2.5 text-sm ${
            message.type === "success" 
              ? "bg-rose-50 border-b border-rose-100 text-rose-900" 
              : "bg-red-50 border-b border-red-100 text-red-900"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl overflow-x-auto gap-1 border border-slate-200/50">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === "dashboard"
                  ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>แดชบอร์ดสถิติ</span>
            </button>

            <button
              onClick={() => setActiveTab("links")}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === "links"
                  ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>จัดการลิงก์ ({links.length})</span>
            </button>
            
            <button
              onClick={() => setActiveTab("sheets")}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === "sheets"
                  ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>จัดการ Google Sheets</span>
            </button>

            <button
              onClick={() => setActiveTab("staff")}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === "staff"
                  ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>รหัสผ่านบุคลากร ({staffPasswordItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === "security"
                  ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>ตั้งค่าระบบ & ความปลอดภัย</span>
            </button>

            {currentUser?.role === "superadmin" && (
              <button
                onClick={() => setActiveTab("admins")}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                  activeTab === "admins"
                    ? "bg-white text-rose-900 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>บัญชีแอดมิน</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Content Area (Scrollable) */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
          
          {/* TAB 0: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top Banner with Real-time Status */}
              <div className="bg-gradient-to-r from-rose-950 via-[#5c0620] to-[#3a0210] text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs uppercase tracking-wider font-bold text-emerald-300">Live Real-time Analytics</span>
                  </div>
                  <h3 className="text-lg font-bold">สถิติการเข้าใช้งานระบบ & ลิงก์สำคัญแบบเรียลไทม์</h3>
                  <p className="text-xs text-rose-200 mt-0.5">ยอดการคลิกเข้าชมจะอัปเดตแบบเรียลไทม์ทันทีเมื่อมีผู้ใช้งานคลิกจากทุกอุปกรณ์</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>ซิงค์อัตโนมัติ</span>
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold">ยอดคลิกเข้าชมรวม</span>
                    <BarChart2 className="w-4 h-4 text-[#5c0620]" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{totalClicks.toLocaleString()}</div>
                  <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>จากทุกลิงก์ในระบบ</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold">ลิงก์ทั้งหมด</span>
                    <Link2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{links.length}</div>
                  <div className="text-[11px] text-slate-500 font-medium">รายการในพอร์ทัล</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold">เฉพาะบุคลากร</span>
                    <Briefcase className="w-4 h-4 text-[#5c0620]" />
                  </div>
                  <div className="text-2xl font-extrabold text-rose-900">{staffLinksCount}</div>
                  <div className="text-[11px] text-rose-600 font-semibold">ระบบภายในต้องใช้รหัส</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold">เฉพาะนักศึกษา / ทั่วไป</span>
                    <GraduationCap className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-sky-900">{studentLinksCount + bothLinksCount}</div>
                  <div className="text-[11px] text-sky-600 font-semibold">นักศึกษา {studentLinksCount} · ทั้งสอง {bothLinksCount}</div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                    <h3 className="font-bold text-slate-800">
                      10 อันดับระบบที่มีการเข้าใช้งานมากที่สุด (Top Visited Systems)
                    </h3>
                  </div>
                </div>
                {topLinksData.length > 0 && topLinksData[0].clicks > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topLinksData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11 }} />
                        <Tooltip 
                          formatter={(value) => [`${value} ครั้ง`, "จำนวนคลิก"]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              return payload[0].payload.fullTitle;
                            }
                            return label;
                          }}
                        />
                        <Bar dataKey="clicks" fill="#5c0620" radius={[0, 6, 6, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400">
                    ยังไม่มีข้อมูลสถิติการคลิก หรือข้อมูลไม่เพียงพอ
                  </div>
                )}
              </div>

              {/* Real-time Usage Table for ALL Links */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                    <div>
                      <h3 className="font-bold text-slate-800">
                        ตารางสถิติการเข้าใช้งานทุกลิงก์ (Real-time Live Table)
                      </h3>
                      <p className="text-xs text-slate-500">เรียงตามยอดเข้าชมจากมากไปน้อย พร้อมระบุกลุ่มเป้าหมาย</p>
                    </div>
                  </div>
                  
                  {/* Search and Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input 
                      type="text"
                      placeholder="ค้นหาระบบ..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20"
                    />
                    <select
                      value={dashboardAudienceFilter}
                      onChange={(e) => setDashboardAudienceFilter(e.target.value as any)}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 text-slate-700"
                    >
                      <option value="all">ทุกลิงก์ ({links.length})</option>
                      <option value="staff">เฉพาะบุคลากร ({staffLinksCount})</option>
                      <option value="student">เฉพาะนักศึกษา ({studentLinksCount})</option>
                      <option value="both">ทั้ง 2 กลุ่ม ({bothLinksCount})</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">ระบบ / ลิงก์</th>
                        <th className="p-3 w-36">กลุ่มเป้าหมาย</th>
                        <th className="p-3 w-40 text-right">ยอดเข้าชม (คลิก)</th>
                        <th className="p-3 w-28 text-right">สัดส่วน (% Share)</th>
                        <th className="p-3 w-20 text-center">เปิดดู</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboardFilteredLinks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            ไม่พบข้อมูลลิงก์ที่ตรงกับเงื่อนไขค้นหา
                          </td>
                        </tr>
                      ) : (
                        dashboardFilteredLinks.map((link, idx) => {
                          const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');
                          const clickShare = totalClicks > 0 ? Math.round(((link.clickCount || 0) / totalClicks) * 100) : 0;
                          return (
                            <tr key={link.id} className="hover:bg-slate-50/70 transition-colors">
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
                                <div className="font-semibold text-slate-800 line-clamp-1">{link.title}</div>
                                <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{link.url}</div>
                              </td>
                              <td className="p-3">
                                {aud === 'staff' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                                    <Briefcase className="w-3 h-3 text-rose-600" />
                                    เฉพาะบุคลากร
                                  </span>
                                ) : aud === 'student' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full">
                                    <GraduationCap className="w-3 h-3 text-sky-600" />
                                    เฉพาะนักศึกษา
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                    <Users className="w-3 h-3 text-slate-500" />
                                    ทั้ง 2 กลุ่ม
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  {(link.clickCount || 0).toLocaleString()}
                                </span>
                                <span className="text-slate-400 text-[11px] ml-1">ครั้ง</span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-[#5c0620] h-full rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, Math.max(4, clickShare))}%` }}
                                    ></div>
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-500 w-8">{clickShare}%</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 inline-flex text-slate-400 hover:text-[#5c0620] hover:bg-rose-50 rounded-lg transition-colors"
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
          )}

          {/* TAB 1: MANAGE LINKS */}
          {activeTab === "links" && (
            <div className="space-y-8">
              {/* Add/Edit Link Form */}
              {currentUser?.role === "superadmin" ? (
                <div id="link-form" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                    <h3 className="font-bold text-slate-800">
                      {editingLinkId ? "แก้ไขข้อมูลลิงก์สำคัญ" : "เพิ่มลิงก์แนะนำใหม่"}
                    </h3>
                  </div>

                <form onSubmit={handleLinkSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-xs font-semibold text-slate-600 block">ชื่อลิงก์ / หัวข้อ <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ระบบบริการการศึกษา (REG)"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1">
                    <label className="text-xs font-semibold text-slate-600 block">
                      กลุ่มเป้าหมายการแสดงผล (Target Audience) <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkTargetAudience('both');
                          setLinkIsStaffOnly(false);
                        }}
                        className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                          linkTargetAudience === 'both'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>ทั้ง 2 กลุ่ม</span>
                        <span className={`text-[9px] ${linkTargetAudience === 'both' ? 'text-slate-300' : 'text-slate-400'}`}>นักศึกษา & บุคลากร</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLinkTargetAudience('student');
                          setLinkIsStaffOnly(false);
                        }}
                        className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                          linkTargetAudience === 'student'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>แค่นักศึกษา</span>
                        <span className={`text-[9px] ${linkTargetAudience === 'student' ? 'text-sky-100' : 'text-slate-400'}`}>ซ่อนจากบุคลากร</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLinkTargetAudience('staff');
                          setLinkIsStaffOnly(true);
                        }}
                        className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                          linkTargetAudience === 'staff'
                            ? 'bg-[#5c0620] text-white border-[#5c0620] shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>แค่บุคลากร</span>
                        <span className={`text-[9px] ${linkTargetAudience === 'staff' ? 'text-rose-200' : 'text-slate-400'}`}>ซ่อนจากนักศึกษา</span>
                      </button>
                    </div>

                    <div className="pt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded-xl hover:bg-slate-50 w-full transition-colors">
                        <input
                          type="checkbox"
                          checked={linkIsPinned}
                          onChange={(e) => setLinkIsPinned(e.target.checked)}
                          className="w-4 h-4 text-[#5c0620] bg-slate-100 border-slate-300 rounded focus:ring-[#5c0620]"
                        />
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                          <Pin className="w-3.5 h-3.5 text-rose-500" />
                          ปักหมุดไว้บนสุด (Pin to Top)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block">ที่อยู่เว็บ (URL) <span className="text-rose-500">*</span></label>
                    <input
                      type="url"
                      required
                      placeholder="เช่น https://reg.ftu.ac.th"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block">คำอธิบายย่อ (เพื่อให้นักศึกษาเข้าใจง่ายขึ้น)</label>
                    <textarea
                      rows={2}
                      placeholder="เช่น ใช้สำหรับลงทะเบียนเรียน เพิ่ม-ถอนรายวิชา และตรวจสอบเกรดเฉลี่ยรายภาคเรียน"
                      value={linkDesc}
                      onChange={(e) => setLinkDesc(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-900 text-sm"
                    />
                  </div>

                  {/* Thumbnail Image section with Upload, Drop & Paste (Ctrl+V) support */}
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between flex-wrap gap-2">
                      <span className="flex items-center gap-1.5">
                        <FileImage className="w-4 h-4 text-rose-900" />
                        <span>รูปภาพประกอบลิงก์ (Thumbnail Image)</span>
                      </span>
                      <span className="text-[10px] bg-rose-50 text-rose-900 px-2 py-0.5 rounded-md font-bold border border-rose-100">
                        ขนาดแนะนำ: 16:10 (ระบบจะปรับขนาดและจัดครอปให้พอดีและกระชับโดยอัตโนมัติ)
                      </span>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left side: URL text field alternative */}
                      <div className="md:col-span-2 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 block">แบบที่ 1: วาง URL รูปภาพจากเว็บไซต์อื่น (เช่น Unsplash, Web URL)</span>
                          <input
                            type="url"
                            placeholder="ป้อน URL รูปภาพ เช่น https://images.unsplash.com/photo-..."
                            value={linkThumbnailUrl}
                            onChange={(e) => setLinkThumbnailUrl(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-900 text-sm font-mono"
                          />
                        </div>

                        <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/60 text-xs text-rose-900 leading-relaxed font-light space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Info className="w-4 h-4 text-rose-900 shrink-0" />
                            <span>เคล็ดลับความสะดวกสูงสุด:</span>
                          </div>
                          <p>
                            เพียงแค่ไปที่ภาพใดก็ได้ กดคลิกขวาแล้วเลือก <strong>"คัดลอกรูปภาพ" (Copy Image)</strong> 
                            แล้วกลับมาที่หน้าต่างนี้แล้วกดปุ่ม <kbd className="bg-white px-1.5 py-0.5 rounded-sm border border-rose-200 font-mono font-bold text-slate-800 text-[10px]">Ctrl + V</kbd> ได้เลยทันที! ระบบจะประมวลผลเซฟลงระบบอัตโนมัติ
                          </p>
                        </div>
                      </div>

                      {/* Right side: Click/Drag/Paste container */}
                      <div className="md:col-span-1 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">แบบที่ 2: อัปโหลด / วางภาพตรงนี้</span>
                        
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

                        {/* Interactive Drop & Paste target */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`h-[120px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2.5 text-center cursor-pointer transition-all ${
                            isDragging
                              ? "border-rose-900 bg-rose-50/70"
                              : linkThumbnailUrl && linkThumbnailUrl.startsWith("data:image")
                              ? "border-rose-300 bg-white"
                              : "border-slate-200 hover:border-rose-900 hover:bg-rose-50 bg-white"
                          }`}
                        >
                          {isProcessingImage ? (
                            <div className="space-y-1.5">
                              <RefreshCw className="w-5 h-5 animate-spin text-rose-900 mx-auto" />
                              <p className="text-[10px] text-slate-500 font-bold">กำลังปรับขนาดรูป...</p>
                            </div>
                          ) : linkThumbnailUrl ? (
                            <div className="relative w-full h-full group/thumb rounded-xl overflow-hidden shadow-2xs">
                              <img
                                src={linkThumbnailUrl}
                                alt="Thumbnail Preview"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <span className="text-[9px] text-white bg-rose-900/90 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <span>คลิกเพื่อเปลี่ยนรูป</span>
                                </span>
                              </div>
                              
                              {/* Clear button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkThumbnailUrl("");
                                }}
                                className="absolute top-1 right-1 p-1 bg-white/95 hover:bg-rose-50 text-rose-900 rounded-full shadow-xs hover:scale-105 transition-all"
                                title="ลบภาพประกอบ"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                              <p className="text-[11px] font-bold text-slate-700">คลิกเพื่อเลือกไฟล์</p>
                              <p className="text-[9px] text-slate-400 font-light">หรือลากวาง / กด Ctrl+V</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-end gap-2.5 pt-2">
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
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                      >
                        ยกเลิกแก้ไข
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-rose-900 hover:bg-rose-950 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-rose-900/10 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>{editingLinkId ? "บันทึกการแก้ไข" : "เพิ่มลิงก์เข้าสู่ระบบ"}</span>
                    </button>
                  </div>
                </form>
              </div>
              ) : (
                 <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto opacity-75" />
                    <h3 className="font-bold text-amber-800">ไม่มีสิทธิ์เพิ่มหรือแก้ไขลิงก์ในระบบส่วนกลาง</h3>
                    <p className="text-sm text-amber-700/80">บัญชีระดับ Admin สามารถจัดการการ <strong>"ปักหมุดส่วนตัว"</strong> ในตารางด้านล่างได้เท่านั้น</p>
                 </div>
              )}

              {/* Existing Links List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 pl-1 flex items-center gap-2">
                  <span>รายการลิงก์ในระบบทั้งหมด</span>
                  <span className="text-xs font-normal text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">{links.length} รายการ</span>
                </h4>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                  {links.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <Info className="w-8 h-8 mx-auto opacity-40" />
                      <p className="text-sm">ยังไม่มีลิงก์ใดๆ ในระบบ คลิกแบบฟอร์มด้านบนเพื่อเพิ่มลิงก์แรก</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                      {links.map((link) => {
                        const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');
                        return (
                          <div key={link.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className="min-w-0 flex-1 flex gap-3">
                              {/* Small thumbnail preview in admin list */}
                              <div className="w-14 h-10 rounded-md bg-slate-100 overflow-hidden shrink-0 border border-slate-150">
                                <img 
                                  src={link.thumbnailUrl || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=100&auto=format&fit=crop"} 
                                  alt="" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-slate-800 text-sm truncate max-w-[250px]">{link.title}</span>
                                  {aud === 'staff' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold text-white bg-[#5c0620] rounded-full inline-flex items-center gap-1">
                                      <Briefcase className="w-2.5 h-2.5" />
                                      เฉพาะบุคลากร
                                    </span>
                                  ) : aud === 'student' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold text-white bg-sky-600 rounded-full inline-flex items-center gap-1">
                                      <GraduationCap className="w-2.5 h-2.5" />
                                      เฉพาะนักศึกษา
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-200 rounded-full inline-flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5" />
                                      ทั้ง 2 กลุ่ม
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({link.clickCount || 0} คลิก)
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 font-mono truncate mb-1">{link.url}</p>
                                {link.description && (
                                  <p className="text-xs text-slate-500 line-clamp-1 italic">{link.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => togglePinStatus(link)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  (currentUser?.role === "superadmin" ? link.isPinned : currentUser?.pinnedLinks?.includes(link.id))
                                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200" 
                                    : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                }`}
                                title={(currentUser?.role === "superadmin" ? link.isPinned : currentUser?.pinnedLinks?.includes(link.id)) ? "ยกเลิกปักหมุด" : "ปักหมุดไว้บนสุด"}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              
                              {currentUser?.role === "superadmin" && (
                                <>
                                  <button
                                    onClick={() => startEditLink(link)}
                                    className="p-1.5 hover:bg-amber-50 text-amber-500 hover:text-amber-700 rounded-lg transition-colors cursor-pointer"
                                    title="แก้ไข"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setLinkToDelete({ id: link.id, title: link.title })}
                                    className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                    title="ลบ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: STAFF PASSWORD MANAGEMENT */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-[#5c0620] text-white rounded-2xl shadow-xs">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      จัดการรหัสผ่านบุคลากร (Staff Passwords Management)
                    </h3>
                    <p className="text-xs text-slate-500">
                      แอดมินสามารถสร้างรหัสผ่านเพื่อแจกจ่ายให้อาจารย์และเจ้าหน้าที่ใช้ปลดล็อกดูลิงก์ "เฉพาะบุคลากร" ได้ทันที
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-rose-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#5c0620] shrink-0" />
                    <span>คำแนะนำการใช้งาน:</span>
                  </div>
                  <p>
                    เมื่อผู้ใช้งานเข้ามาที่หน้าเว็บหลักและคลิกแท็บ <strong>"บุคลากร"</strong> ระบบจะถามหารหัสผ่านนี้ หากกรอกถูกต้องระบบจะแสดงเฉพาะลิงก์ที่บุคลากรมีสิทธิ์เข้าถึง (ลิงก์ทั่วไป + ลิงก์เฉพาะบุคลากร) และจะซ่อนลิงก์เฉพาะนักศึกษาโดยอัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Form to Add New Staff Passcode */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    สร้างรหัสผ่านใหม่สำหรับบุคลากร (Add Staff Passcode)
                  </h4>
                </div>

                <form onSubmit={handleAddStaffPassword} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">
                        รหัสผ่านที่ต้องการ (Passcode) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="เช่น STAFF-2024 หรือ SCI-9999"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateRandomStaffCode}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="สุ่มรหัสผ่านอัตโนมัติ"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>สุ่มรหัส</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">
                        หมายเหตุ / ป้ายกำกับ (Label / Note - ระบุหรือไม่ก็ได้)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น อาจารย์สาขาวิทยาการคอมฯ, เจ้าหน้าที่สายสนับสนุน"
                        value={newStaffPasswordLabel}
                        onChange={(e) => setNewStaffPasswordLabel(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newStaffPassword.trim()}
                      className="px-5 py-2.5 bg-[#5c0620] hover:bg-rose-950 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-[#5c0620]/15 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>บันทึกและเปิดใช้งานรหัสนี้</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* List of Active Staff Passwords */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      รายการรหัสผ่านบุคลากรที่ใช้งานได้ ({staffPasswordItems.length} รหัส)
                    </h4>
                  </div>
                </div>

                {staffPasswordItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 space-y-2">
                    <Key className="w-8 h-8 mx-auto opacity-30 text-rose-800" />
                    <p className="text-sm">ยังไม่มีรหัสผ่านบุคลากรในระบบ</p>
                    <p className="text-xs text-slate-400">กรุณาสร้างรหัสผ่านในแบบฟอร์มด้านบนเพื่อให้บุคลากรใช้เข้าดูลิงก์เฉพาะบุคลากรได้</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {staffPasswordItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-base font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                              {item.code}
                            </span>
                            {item.label && (
                              <span className="text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full">
                                {item.label}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>สร้างเมื่อ: {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : "ไม่ระบุ"}</span>
                            {item.createdBy && <span>· โดย {item.createdBy}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(item.id, item.code)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                              copiedCodeId === item.id
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {copiedCodeId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>คัดลอกรหัส</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveStaffPassword(item.code)}
                            disabled={isSubmitting}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                            title="ลบรหัสนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Individual Staff Accounts Form */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 bg-[#5c0620] rounded-full"></div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      เพิ่มบัญชีบุคลากรแบบระบุชื่อผู้ใช้ (Individual Staff Account)
                    </h4>
                    <p className="text-xs text-slate-500">
                      สำหรับให้อาจารย์/บุคลากรล็อกอินด้วย Username และ Password ของตนเอง
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddStaffAccount} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">
                        ชื่อผู้ใช้งาน (Staff Username) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น somchai.p หรือ staff_fst"
                        value={newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">
                        รหัสผ่าน (Staff Password) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="รหัสผ่านเข้าใช้งาน"
                        value={newStaffAccountPassword}
                        onChange={(e) => setNewStaffAccountPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5c0620]/20 focus:border-[#5c0620] text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newStaffUsername.trim() || !newStaffAccountPassword.trim()}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>เพิ่มบัญชีบุคลากร</span>
                    </button>
                  </div>
                </form>

                {/* List of Staff Accounts */}
                {adminUsers.filter(u => u.role === "staff").length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="text-xs font-bold text-slate-600">บัญชีบุคลากรในระบบ:</div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                      {adminUsers.filter(u => u.role === "staff").map((staffUser, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-[#5c0620]" />
                            <span className="font-semibold text-slate-800">{staffUser.username}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                              รหัส: {(staffUser as any).password || "••••••••"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdmin(staffUser.username)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="ลบบัญชีนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: GOOGLE SHEETS */}
          {activeTab === "sheets" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2.5 bg-emerald-500 text-white rounded-2xl">
                    <Grid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">เชื่อมต่อและจัดการข้อมูลผ่าน Google Sheets</h3>
                    <p className="text-xs text-slate-500">บันทึกข้อมูลลิงก์ทั้งหมดไปยัง Google Sheets แบบเรียลไทม์ (ผ่าน Web App Script)</p>
                  </div>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">เปิดใช้งานการซิงค์ข้อมูลกับ Google Sheets</label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={adminConfig.isGoogleSheetSyncEnabled || false}
                        onChange={(e) => onUpdateConfig({ isGoogleSheetSyncEnabled: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">เปิดการซิงค์ข้อมูลอัตโนมัติ</span>
                    </label>
                  </div>

                  {adminConfig.isGoogleSheetSyncEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 block">Google Apps Script Web App URL</label>
                        <input
                          type="text"
                          placeholder="https://script.google.com/macros/s/.../exec"
                          value={adminConfig.googleAppsScriptUrl || ""}
                          onChange={(e) => onUpdateConfig({ googleAppsScriptUrl: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 block">ความถี่ในการดึงข้อมูลอัปเดต (วินาที)</label>
                        <input
                          type="number"
                          min="5"
                          placeholder="10"
                          value={adminConfig.syncInterval || 5}
                          onChange={(e) => onUpdateConfig({ syncInterval: parseInt(e.target.value, 10) || 5 })}
                          className="w-full max-w-[150px] px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono"
                        />
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-3">
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
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
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
                          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>ดึงข้อมูลล่าสุดจาก Google Sheets</span>
                        </button>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-4">
                        <h4 className="text-sm font-bold text-slate-700">โค้ดสำหรับ Google Apps Script</h4>
                        <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1.5 mb-2">
                          <li>เปิด Google Sheets ของคุณ ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> {'>'} <strong>Apps Script</strong></li>
                          <li>คัดลอกโค้ดด้านล่างไปวางแทนที่ของเดิม (สามารถระบุ SPREADSHEET_ID ได้ถ้าต้องการ)</li>
                          <li>กด <strong>การทำให้ใช้งานได้ (Deploy)</strong> {'>'} <strong>การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong></li>
                          <li>เลือกประเภท <strong>เว็บแอป (Web app)</strong></li>
                          <li>ตั้งค่า <strong>ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)</strong> และกด <strong>ทำให้ใช้งานได้</strong></li>
                          <li>คัดลอก <strong>URL ของเว็บแอป</strong> มาใส่ในช่องด้านบน</li>
                        </ol>

                        <div className="relative">
                          <textarea
                            readOnly
                            className="w-full h-48 p-3 text-[10px] font-mono text-slate-600 bg-white rounded-lg border border-slate-200 focus:outline-hidden resize-none"
                            value={GAS_SCRIPT_TEMPLATE}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE);
                              showAlert("คัดลอกสคริปต์แล้ว");
                            }}
                            className="absolute top-2 right-2 px-2 py-1 bg-white border border-slate-200 text-xs rounded-md shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            คัดลอก
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY SETTINGS */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Site Info Config */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2.5 bg-indigo-500 text-white rounded-2xl">
                    <Grid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">จัดการข้อมูลเว็บไซต์หน้าบ้าน (Site Info)</h3>
                    <p className="text-xs text-slate-500">ตั้งชื่อและโลโก้ที่แสดงบนแท็บของเบราว์เซอร์</p>
                  </div>
                </div>

                <form onSubmit={handleSiteInfoSubmit} className="space-y-4 max-w-xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">ชื่อเว็บไซต์ (Site Title)</label>
                    <input
                      type="text"
                      placeholder="เช่น ระบบพอร์ทัลลิงก์สำคัญ FST"
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">โลโก้ (Favicon & Tab Icon)</label>
                    <div className="flex gap-4 items-center">
                      {siteLogoUrl && (
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          <img src={siteLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="วาง URL ของรูปภาพโลโก้ที่นี่"
                          value={siteLogoUrl}
                          onChange={(e) => setSiteLogoUrl(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">หรืออัปโหลดไฟล์รูปภาพ:</span>
                          <label className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                            เลือกไฟล์
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

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>บันทึกข้อมูลเว็บไซต์</span>
                  </button>
                </form>
              </div>

              {/* Announcement Config */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2.5 bg-blue-500 text-white rounded-2xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">ประกาศแจ้งเตือนด่วน (Announcement Banner)</h3>
                    <p className="text-xs text-slate-500">จัดการข้อความแจ้งเตือนที่แถบด้านบนสุดของเว็บไซต์</p>
                  </div>
                </div>

                <form onSubmit={handleAnnouncementSubmit} className="space-y-4 max-w-xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">สถานะการแสดงผล</label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={isAnnouncementActive}
                        onChange={(e) => setIsAnnouncementActive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">เปิดใช้งานแถบประกาศแจ้งเตือน</span>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">ข้อความประกาศแจ้งเตือน</label>
                    <textarea
                      rows={3}
                      placeholder="เช่น ประกาศ: กำหนดการลงทะเบียนเรียนภาคการศึกษาที่ 2/2567 เริ่มวันที่ 1-5 พฤศจิกายน"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      disabled={!isAnnouncementActive}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm disabled:opacity-50 disabled:bg-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-blue-600/10 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>บันทึกการตั้งค่าประกาศ</span>
                  </button>
                </form>
              </div>

              {/* Change Admin Password */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-amber-500 text-white rounded-2xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">เปลี่ยนรหัสผ่านบัญชีของคุณ ({currentUser?.username})</h3>
                    <p className="text-xs text-slate-500">กำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบของบัญชีที่กำลังใช้งานอยู่</p>
                  </div>
                </div>

                <form onSubmit={handleChangeMyPassword} className="max-w-xl space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">รหัสผ่านใหม่ (New Password)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="กรอกรหัสผ่านใหม่..."
                        value={myNewPassword}
                        onChange={(e) => setMyNewPassword(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !myNewPassword.trim()}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-amber-600/10 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>บันทึกรหัสผ่านใหม่</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Staff Password Config */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-rose-500 text-white rounded-2xl">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">จัดการรหัสผ่านหมวดหมู่บุคลากร (Staff Passwords)</h3>
                    <p className="text-xs text-slate-500">ออกรหัสให้บุคลากรได้หลายชุด บุคลากรต้องใส่รหัสก่อนจึงจะกดปุ่ม "บุคลากร" ดูลิงก์สำหรับบุคลากรได้ ลบรหัสเมื่อต้องการยกเลิกสิทธิ์</p>
                  </div>
                </div>

                <div className="max-w-xl space-y-4">
                  {staffPasswords.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">รหัสที่สร้างจากเครื่องนี้ ({staffPasswords.length}) · ใช้งานได้ทั้งหมดในระบบ {(adminConfig.staffCodeHashes || []).length} รหัส</label>
                      <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                        {staffPasswords.map((pwd, idx) => (
                          <div key={idx} className={`flex items-center justify-between px-4 py-3 ${idx !== staffPasswords.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <div className="font-mono text-sm tracking-wide text-slate-700">{pwd}</div>
                            <button
                              type="button"
                              onClick={() => handleRemoveStaffPassword(pwd)}
                              disabled={isSubmitting}
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                              title="ลบรหัสผ่าน"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      ยังไม่มีรหัสที่สร้างจากเครื่องนี้ (รหัสที่ใช้งานได้ทั้งหมดในระบบ: {(adminConfig.staffCodeHashes || []).length} รหัส)
                    </div>
                  )}

                  <form onSubmit={handleAddStaffPassword} className="pt-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">เพิ่มรหัสผ่านใหม่</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="พิมพ์รหัสผ่านที่ต้องการ..."
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !newStaffPassword.trim()}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/10 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>เพิ่มรหัสผ่าน</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Data Backup & Transfer Config (For Vercel / Cross-Domain Migration) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-2xl">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">สำรองและย้ายข้อมูลเว็บไซต์ (Backup & Transfer for Vercel)</h3>
                    <p className="text-xs text-slate-500">
                      ส่งออกข้อมูลทุกลิงก์, โลโก้, ประกาศ และการตั้งค่า เพื่อนำไปซิงค์บน Vercel หรือย้ายอุปกรณ์ได้ในคลิกเดียว
                    </p>
                  </div>
                </div>

                {backupStatus && (
                  <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    backupStatus.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {backupStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span>{backupStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Export Box */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-700">1. ส่งออกข้อมูลจาก AI Studio (Export)</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ดาวน์โหลดข้อมูลลิงก์ทั้งหมด ({links.length} ลิงก์), รูปโลโก้ และการตั้งค่าเว็บไซต์เป็นไฟล์ JSON
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลดไฟล์ JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyBackupJSON}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isCopiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{isCopiedBackup ? "คัดลอกแล้ว" : "คัดลอก JSON"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Import Box */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-700">2. นำเข้าข้อมูลบน Vercel (Import)</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      เปิดหน้าเว็บนี้บน Vercel แล้วกดเลือกไฟล์ JSON ที่สำรองไว้ เพื่อนำข้อมูลทั้งหมดมาแสดงทันที
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
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>เลือกไฟล์ JSON เพื่อนำเข้า</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADMIN ACCOUNTS (SUPERADMIN ONLY) */}
          {activeTab === "admins" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2.5 bg-amber-600 text-white rounded-2xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">จัดการบัญชีผู้ดูแลระบบ (Admin Accounts)</h3>
                    <p className="text-xs text-slate-500">จัดการสิทธิ์ผู้ใช้งาน (เฉพาะ Superadmin เท่านั้นที่เข้าถึงส่วนนี้ได้)</p>
                  </div>
                </div>

                {currentUser?.role !== "superadmin" ? (
                   <div className="p-8 text-center text-rose-500 bg-rose-50 rounded-2xl border border-rose-100 font-semibold flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-8 h-8" />
                      <span>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (ต้องการสิทธิ์ Superadmin)</span>
                   </div>
                ) : (
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-700 text-sm">รายชื่อแอดมินในระบบ</h4>
                     </div>
                     <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-sm text-slate-500 mb-6">
                        บัญชี Superadmin สามารถจัดการแอดมินคนอื่นๆ ได้ เพื่อมอบสิทธิ์ในการจัดการลิงก์
                     </div>
                     
                     <form onSubmit={handleAddAdmin} className="space-y-4 bg-amber-50/30 p-5 rounded-2xl border border-amber-100">
                        <h4 className="font-semibold text-slate-700 text-sm">เพิ่มบัญชีผู้ดูแลระบบ (Add Admin)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-600 block">ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span></label>
                              <input
                                 type="text"
                                 required
                                 value={newAdminUsername}
                                 onChange={(e) => setNewAdminUsername(e.target.value)}
                                 className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                                 placeholder="เช่น admin_fahsai"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-600 block">รหัสผ่าน (Password) <span className="text-rose-500">*</span></label>
                              <input
                                 type="password"
                                 required
                                 value={newAdminPassword}
                                 onChange={(e) => setNewAdminPassword(e.target.value)}
                                 className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-mono"
                                 placeholder="รหัสผ่านเข้าใช้งาน"
                              />
                           </div>
                           <div className="space-y-1.5 md:col-span-2">
                              <label className="text-xs font-semibold text-slate-600 block">บทบาท (Role) <span className="text-rose-500">*</span></label>
                              <select 
                                 value={newAdminRole}
                                 onChange={(e) => setNewAdminRole(e.target.value as "admin" | "superadmin" | "staff")}
                                 className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm bg-white"
                              >
                                 <option value="admin">Admin (ผู้ดูแลระบบ: ปักหมุดของตัวเอง, จัดการลิงก์ได้บางส่วน)</option>
                                 <option value="staff">บุคลากร (ล็อกอินที่ปุ่ม &quot;บุคลากร&quot; เพื่อดูลิงก์บุคลากร เข้าหลังบ้านไม่ได้)</option>
                                 <option value="superadmin">Superadmin (ผู้ดูแลระบบสูงสุด: จัดการได้ทุกอย่าง)</option>
                              </select>
                           </div>
                        </div>
                        <div className="pt-2">
                           <button
                              type="submit"
                              disabled={isSubmitting}
                              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                           >
                              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              บันทึกบัญชีผู้ดูแลระบบ
                           </button>
                        </div>
                     </form>

                     <div className="space-y-2 mt-6">
                        <h4 className="font-semibold text-slate-700 text-sm">รายชื่อแอดมินจำลอง (เนื่องจากข้อจำกัดเรื่อง CORS)</h4>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                           {adminUsers.length > 0 ? adminUsers.map((admin, idx) => (
                              <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                                 <div>
                                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                                       {admin.username}
                                       {admin.role === "superadmin" && (
                                          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Superadmin</span>
                                       )}
                                       {admin.role === "staff" && (
                                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm tracking-wider">บุคลากร</span>
                                       )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      รหัสผ่าน: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded-sm">{(admin as any).password || "••••••••"}</span> 
                                      <span className="ml-1 opacity-70">(แอดมินหลักสามารถดูได้)</span>
                                    </div>
                                 </div>
                                 {admin.username !== currentUser.username && (
                                    <button 
                                       onClick={() => handleDeleteAdmin(admin.username)}
                                       className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer self-start sm:self-center shrink-0"
                                       title="ลบบัญชีนี้"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 )}
                              </div>
                           )) : (
                              <div className="p-8 text-center text-slate-400 text-sm">
                                 ยังไม่มีข้อมูลแอดมินจำลอง เพิ่มแอดมินใหม่ที่ฟอร์มด้านบน
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};

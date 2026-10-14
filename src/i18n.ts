import { Link, LinkCategory, TargetAudience } from "./types";

export type Language = "th" | "en";

// 📚 พจนานุกรมแปลคำศัพท์ทางการศึกษาและระบบมหาวิทยาลัย (Curated Academic Terms)
export const ACADEMIC_GLOSSARY: Record<string, string> = {
  // Titles of seeded systems
  "ระบบลงทะเบียนเรียนมหาวิทยาลัย (REG Portal)": "University Registration System (REG Portal)",
  "ระบบการเรียนการสอนออนไลน์ (F-LMS)": "Online Learning Management System (F-LMS)",
  "ห้องสมุดกลางและสืบค้นงานวิจัยดิจิทัล": "Central Library & Digital Research Database",
  "เว็บไซต์คณะวิทยาศาสตร์และเทคโนโลยี": "Faculty of Science & Technology Website",
  "เพจ Facebook ประชาสัมพันธ์คณะวิทยาศาสตร์ฯ": "Faculty of Science Facebook Page",
  "ระบบยื่นคำร้องและเอกสารออนไลน์นักศึกษา": "Student Online Petition & Document System",
  "ติดต่อสอบถามและงานบริการนักศึกษา": "Student Affairs & Support Services",
  "บริการจัดการซอฟต์แวร์ลิขสิทธิ์และบัญชีอีเมลนักศึกษา": "Licensed Software & Student Email Services",
  "ระบบฐานข้อมูลบุคลากร (HRIS)": "Human Resource Information System (HRIS)",
  "ระบบสารบรรณอิเล็กทรอนิกส์ (e-Document)": "Electronic Document System (e-Document)",

  // Descriptions of seeded systems
  "บริการตรวจสอบตารางเรียน ลงทะเบียนเรียน เพิ่ม-ถอนรายวิชา และตรวจสอบผลการเรียน (เกรด)":
    "Check class schedules, register courses, add/drop subjects, and view academic grades.",
  "ระบบ Moodle / Google Classroom สำหรับห้องเรียนออนไลน์ ส่งการบ้าน ทำแบบทดสอบ และดาวน์โหลดสื่อประกอบการเรียน":
    "Moodle & Google Classroom platform for online classes, homework submissions, quizzes, and learning materials.",
  "สืบค้นหนังสือ ตำราเรียน เอกสารวิชาการ และเข้าใช้งานฐานข้อมูลวิจัยออนไลน์ระดับนานาชาติฟรีสำหรับนักศึกษา":
    "Search books, textbooks, academic documents, and access international research databases for students.",
  "เข้าชมข่าวประกาศทางการ หลักสูตรวิชาการ ข้อมูลคณาจารย์ และกิจกรรมประชาสัมพันธ์ของคณะ":
    "Official news announcements, academic curricula, faculty members, and faculty public relations.",
  "ติดตามข่าวสารด่วน ประกาศสำคัญ กิจกรรมนักศึกษา และภาพบรรยากาศการเรียนรู้อย่างใกล้ชิด":
    "Follow urgent news, important announcements, student activities, and campus updates.",
  "บริการส่งคำร้องวิชาการ คำร้องทั่วไป ใบลา หรือแบบฟอร์มเอกสารต่างๆ ผ่านระบบออนไลน์รวดเร็วทันใจ":
    "Submit academic requests, general petitions, leave requests, and various digital forms online.",
  "ช่องทางติดต่อเจ้าหน้าที่บริการนักศึกษา เบอร์โทรด่วน อีเมล และแผนกต่างๆ ภายในอาคารคณะฯ":
    "Contact student support staff, emergency telephone numbers, emails, and faculty departments.",
  "รับสิทธิ์ดาวน์โหลด Microsoft Office 365, MATLAB, Windows แท้ และจัดการบริการ Wi-Fi ของมหาวิทยาลัย":
    "Download genuine Microsoft Office 365, MATLAB, Windows, and manage campus Wi-Fi access.",
  "ระบบจัดการข้อมูลประวัติส่วนตัว สลิปเงินเดือน สวัสดิการ และประเมินผลการปฏิบัติงาน":
    "Personal profile, salary slips, employee benefits, and performance evaluation system.",
  "ระบบรับ-ส่ง หนังสือราชการ บันทึกข้อความ และการจองห้องประชุมภายในคณะฯ":
    "Official governmental document dispatch, memo management, and faculty meeting room reservations.",

  // Common Academic Terms
  "ระบบสำหรับมหาวิทยาลัย": "University Systems",
  "ระบบสำหรับคณะวิทยาศาสตร์": "Faculty of Science Systems",
  "นักศึกษา": "Students",
  "บุคลากร": "Staff",
  "ทุกคน": "Everyone",
  "คณะวิทยาศาสตร์และเทคโนโลยี": "Faculty of Science and Technology",
  "มหาวิทยาลัยฟัตตอนี": "Fatoni University",
};

// 🌐 UI Strings Dictionary
export const UI_DICTIONARY = {
  // Brand & Header
  siteFaculty: {
    th: "คณะวิทยาศาสตร์และเทคโนโลยี",
    en: "Faculty of Science & Technology",
  },
  heroGreeting: {
    th: "คณะวิทยาศาสตร์และเทคโนโลยี",
    en: "Faculty of Science & Technology",
  },
  heroTitle: {
    th: "วันนี้ต้องใช้ระบบไหน?",
    en: "Which system do you need today?",
  },
  searchPlaceholder: {
    th: "พิมพ์ชื่อระบบ เช่น เกรด, คำร้อง, Wi‑Fi...",
    en: "Search systems e.g. Grades, Petitions, Wi-Fi...",
  },
  clearSearch: {
    th: "ล้างคำค้นหา",
    en: "Clear search",
  },

  // Audience
  audienceGroup: {
    th: "กลุ่มผู้ใช้",
    en: "Target Audience",
  },
  student: {
    th: "นักศึกษา",
    en: "Students",
  },
  staff: {
    th: "บุคลากร",
    en: "Staff",
  },
  both: {
    th: "ทุกคน",
    en: "Everyone",
  },

  // Categories
  categories: {
    th: "หมวดหมู่ระบบ",
    en: "System Categories",
  },
  catAll: {
    th: "ทั้งหมด",
    en: "All Systems",
  },
  catUniversity: {
    th: "ระบบสำหรับมหาวิทยาลัย",
    en: "University Systems",
  },
  catFaculty: {
    th: "ระบบสำหรับคณะวิทยาศาสตร์",
    en: "Faculty Systems",
  },
  catUniversityShort: {
    th: "มหาวิทยาลัย",
    en: "University",
  },
  catFacultyShort: {
    th: "คณะวิทย์ฯ",
    en: "SciTech",
  },

  // My Pins
  myPins: {
    th: "หมุดของฉัน",
    en: "My Pins",
  },
  myPinsEmpty: {
    th: "กดปุ่ม หมุด บนการ์ดเว็บที่ใช้บ่อย แล้วเว็บนั้นจะมาอยู่ตรงนี้ หมุดเก็บไว้ในเครื่องของคุณเอง คนอื่นไม่เห็น",
    en: "Click the pin icon on frequently used websites to pin them here. Your pins are saved only on your device.",
  },
  removePin: {
    th: "เอาออกจากหมุด",
    en: "Remove from pins",
  },
  itemsCount: {
    th: "รายการ",
    en: "items",
  },

  // Search Results & States
  searchResults: {
    th: "ผลการค้นหา",
    en: "Search results for",
  },
  loadingLinks: {
    th: "กำลังโหลดลิงก์...",
    en: "Loading systems...",
  },
  noLinksFound: {
    th: "ไม่พบลิงก์ที่ตรงกับคำค้นหา",
    en: "No systems found matching your search",
  },
  tryOtherKeywords: {
    th: "ลองใช้คำอื่น หรือดูลิงก์ทั้งหมด",
    en: "Try searching with different keywords or browse all systems",
  },
  viewAllLinks: {
    th: "ดูลิงก์ทั้งหมด",
    en: "View all systems",
  },
  clicks: {
    th: "ครั้ง",
    en: "clicks",
  },
  openWebsite: {
    th: "เปิดใช้งาน",
    en: "Open",
  },
  pinned: {
    th: "ปักหมุด",
    en: "Pinned",
  },

  // Staff Portal Banner
  staffPortalBannerTitle: {
    th: "โหมดบุคลากร (Staff Portal)",
    en: "Staff Portal Mode",
  },
  signedInAs: {
    th: "เข้าสู่ระบบในชื่อ:",
    en: "Signed in as:",
  },
  staffPortalDesc: {
    th: "แสดงเฉพาะระบบสำหรับบุคลากรและระบบทั่วไป (ซ่อนระบบเฉพาะนักศึกษาอัตโนมัติ)",
    en: "Showing staff and general systems (student-only systems are hidden)",
  },
  exitStaffMode: {
    th: "ออกจากโหมดนี้",
    en: "Exit Mode",
  },

  // Theme & Navigation
  toggleLight: {
    th: "เปลี่ยนเป็นโหมดสว่าง (Light Mode)",
    en: "Switch to Light Mode",
  },
  toggleDark: {
    th: "เปลี่ยนเป็นโหมดมืด (Dark Mode)",
    en: "Switch to Dark Mode",
  },
  adminManagement: {
    th: "จัดการข้อมูล",
    en: "Admin Panel",
  },
  adminLogin: {
    th: "เข้าสู่ระบบผู้ดูแล",
    en: "Admin Login",
  },
  adminLogout: {
    th: "ออกจากระบบแอดมิน",
    en: "Sign Out",
  },

  // Footer
  footerAboutTitle: {
    th: "คณะวิทยาศาสตร์และเทคโนโลยี",
    en: "Faculty of Science and Technology",
  },
  footerAboutDesc: {
    th: "มุ่งเน้นการสร้างสรรค์องค์ความรู้ งานวิจัย และพัฒนากำลังคนด้านวิทยาศาสตร์ ไอที และเทคโนโลยี เพื่อการพัฒนาสังคมและเศรษฐกิจที่ยั่งยืน",
    en: "Dedicated to fostering knowledge, research, and high-caliber personnel in science, IT, and technology for sustainable development.",
  },
  footerContactTitle: {
    th: "ช่องทางการติดต่อคณะ",
    en: "Contact Information",
  },
  footerAddress: {
    th: "อาคารคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยฟัตตอนี",
    en: "Faculty of Science & Technology Bldg., Fatoni University",
  },
  footerAdminTitle: {
    th: "ผู้ดูแลระบบและจัดการข้อมูล",
    en: "System Management",
  },
  footerAdminDesc: {
    th: "เข้าสู่ระบบหลังบ้านเพื่อจัดการพอร์ทัลลิงก์ สำหรับเจ้าหน้าที่และบุคลากร",
    en: "Log in to portal administration for faculty and staff managers.",
  },
  openAdminControl: {
    th: "เปิดแผงควบคุมระบบ (Admin Control)",
    en: "Open Admin Control Panel",
  },
  adminPortalBtn: {
    th: "เข้าสู่หลังบ้านแอดมิน",
    en: "Admin Portal",
  },

  // Modals
  staffModalTitle: {
    th: "เข้าสู่ระบบบุคลากร",
    en: "Staff Passcode Verification",
  },
  staffModalDesc: {
    th: "กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานลิงก์และระบบเฉพาะสำหรับบุคลากร",
    en: "Please enter your passcode to access staff-only systems.",
  },
  staffPasscodePlaceholder: {
    th: "กรอกรหัสผ่านบุคลากร...",
    en: "Enter staff passcode...",
  },
  cancel: {
    th: "ยกเลิก",
    en: "Cancel",
  },
  confirm: {
    th: "ยืนยันรหัสผ่าน",
    en: "Confirm Passcode",
  },
  adminLoginModalTitle: {
    th: "เข้าสู่ระบบผู้ดูแลระบบ",
    en: "Administrator Login",
  },
  adminLoginModalDesc: {
    th: "ลงชื่อเข้าใช้เพื่อแก้ไขลิงก์ ตั้งค่าระบบ และดูสถิติการใช้งาน",
    en: "Sign in to manage links, adjust settings, and view real-time statistics.",
  },
  username: {
    th: "ชื่อผู้ใช้ (Username)",
    en: "Username",
  },
  password: {
    th: "รหัสผ่าน (Password)",
    en: "Password",
  },
  signIn: {
    th: "เข้าสู่ระบบ",
    en: "Sign In",
  },
  checkingAuth: {
    th: "กำลังตรวจสอบ...",
    en: "Verifying...",
  },
  realtimeStats: {
    th: "สถิติเรียลไทม์",
    en: "Real-time Stats",
  },
  linksCount: {
    th: "รายการลิงก์",
    en: "Links",
  },
} as const;

export type TranslationKey = keyof typeof UI_DICTIONARY;

// ⚡ ฟังก์ชันดึงคำแปลของ UI
export const getTranslation = (key: TranslationKey, lang: Language): string => {
  const item = UI_DICTIONARY[key];
  if (!item) return key;
  return item[lang] || item["th"] || key;
};

// 💾 Local Cache for Translations
const TRANSLATION_CACHE_KEY = "scitech_translations_cache_v1";

const getTranslationCache = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveTranslationCache = (cache: Record<string, string>) => {
  try {
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

// ตรวจสอบว่าข้อความเป็นภาษาไทยหรือไม่
export const containsThai = (text: string): boolean => {
  return /[\u0E00-\u0E7F]/.test(text);
};

// 🤖 ระบบแปลภาษาอัตโนมัติจากไทย -> อังกฤษ (Auto-Translate Thai to English)
export const autoTranslateThaiToEnglish = async (text: string): Promise<string> => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // 1. ตรวจสอบว่าอยู่ในพจนานุกรมศัพท์เฉพาะ (Glossary) หรือไม่
  if (ACADEMIC_GLOSSARY[trimmed]) {
    return ACADEMIC_GLOSSARY[trimmed];
  }

  // 2. ถ้าไม่มีตัวอักษรไทยเลย ถือว่าเป็นภาษาอังกฤษหรือสากลแล้ว คืนค่าได้ทันที
  if (!containsThai(trimmed)) {
    return trimmed;
  }

  // 3. ตรวจสอบใน Cache ท้องถิ่น (LocalStorage)
  const cache = getTranslationCache();
  if (cache[trimmed]) {
    return cache[trimmed];
  }

  // 4. แปลผ่าน Google Translate GTX API (รองรับ CORS * ใน Browser)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0] || "").join("").trim();
        if (translated) {
          cache[trimmed] = translated;
          saveTranslationCache(cache);
          return translated;
        }
      }
    }
  } catch (err) {
    console.warn("Google Translate API attempt failed, trying fallback:", err);
  }

  // 5. Fallback สำรองผ่าน MyMemory API
  try {
    const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=th|en`;
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText?.trim();
      if (translated && !translated.toLowerCase().includes("mymemory")) {
        cache[trimmed] = translated;
        saveTranslationCache(cache);
        return translated;
      }
    }
  } catch (fbErr) {
    console.warn("Fallback translation attempt failed:", fbErr);
  }

  // 6. ถ้าแปลไม่ได้ ให้คืนค่าข้อความเดิม
  return trimmed;
};

// แปลข้อมูล Link ทั้งหมด (Title & Description) สำหรับภาษาอังกฤษ
export const translateLinkObject = async (link: Link): Promise<Link> => {
  const [translatedTitle, translatedDesc] = await Promise.all([
    autoTranslateThaiToEnglish(link.title),
    link.description ? autoTranslateThaiToEnglish(link.description) : Promise.resolve("")
  ]);

  return {
    ...link,
    title: translatedTitle || link.title,
    description: translatedDesc || link.description,
  };
};

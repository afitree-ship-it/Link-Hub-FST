import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, AdminConfig, User, AuthCredentials } from "./types";
import { DEFAULT_LINKS } from "./data/seed";
import { BentoCard, BentoVariant, SiteIcon } from "./components/BentoCard";

// Lazy-load heavy AdminPanel for faster initial bundle and instant page render
const AdminPanel = React.lazy(() =>
  import("./components/AdminPanel").then(module => ({ default: module.AdminPanel }))
);
import { 
  GraduationCap, 
  Search, 
  Settings, 
  LogOut, 
  Sparkles, 
  X, 
  ShieldAlert,
  Loader2,
  Lock,
  Globe,
  Info,
  MapPin,
  Mail,
  LayoutGrid,
  List as ListIcon,
  AlignJustify,
  ChevronDown,
  Check,
  ArrowUp,
  Pin,
  Briefcase,
  Sun,
  Moon,
  Building2,
  FlaskConical
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { hashStaffCode, parseStaffCodeHashes } from "./staffCodes";
import { sendActionToWebApp, getLastWriteAt, WRITE_SETTLE_MS, DEFAULT_GAS_URL, normalizeLink } from "./googleSheets";
import { Language, getTranslation, autoTranslateThaiToEnglish, ACADEMIC_GLOSSARY } from "./i18n";

export default function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"student" | "staff">("student");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "university" | "faculty">("all");
  const [staffAccountName, setStaffAccountName] = useState<string>(() => {
    return sessionStorage.getItem("scitech_staff_name") || "";
  });
  const [layoutMode, setLayoutMode] = useState<"grid" | "list" | "compact">("grid");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Language State (Thai / English with National Flags)
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("scitech_lang");
      if (saved === "th" || saved === "en") return saved;
    } catch {}
    return "th";
  });

  useEffect(() => {
    try {
      localStorage.setItem("scitech_lang", lang);
    } catch {}
  }, [lang]);

  // Translated Links Cache/Map for English Mode
  const [translatedLinksMap, setTranslatedLinksMap] = useState<Record<string, { title: string; description?: string }>>({});

  useEffect(() => {
    if (lang !== "en" || !links || links.length === 0) return;
    let isCancelled = false;

    const translateLinks = async () => {
      const updates: Record<string, { title: string; description?: string }> = {};
      let hasNew = false;

      for (const link of links) {
        if (isCancelled) break;
        if (!link || !link.id) continue;
        if (translatedLinksMap[link.id]) continue;

        const titleText = typeof link.title === "string" ? link.title.trim() : String(link.title || "").trim();
        const descText = typeof link.description === "string" ? link.description.trim() : (link.description ? String(link.description).trim() : "");

        // Check curated glossary first
        const glossaryTitle = ACADEMIC_GLOSSARY[titleText];
        const glossaryDesc = descText ? ACADEMIC_GLOSSARY[descText] : undefined;

        if (glossaryTitle && (!descText || glossaryDesc !== undefined)) {
          updates[link.id] = {
            title: glossaryTitle,
            description: glossaryDesc || descText,
          };
          hasNew = true;
        } else {
          // Asynchronously fetch auto-translation
          try {
            const [tTitle, tDesc] = await Promise.all([
              autoTranslateThaiToEnglish(titleText),
              descText ? autoTranslateThaiToEnglish(descText) : Promise.resolve("")
            ]);
            if (!isCancelled) {
              updates[link.id] = {
                title: tTitle || titleText,
                description: tDesc || descText,
              };
              hasNew = true;
            }
          } catch (e) {
            updates[link.id] = { title: titleText, description: descText };
          }
        }
      }

      if (hasNew && !isCancelled) {
        setTranslatedLinksMap(prev => ({ ...prev, ...updates }));
      }
    };

    translateLinks();

    return () => {
      isCancelled = true;
    };
  }, [lang, links]);

  // Dark / Light Theme State
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("scitech_theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("scitech_theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Admin States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authCreds, setAuthCreds] = useState<AuthCredentials | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Login Form States
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({});

  // Staff Access States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPasswordInput, setStaffPasswordInput] = useState("");
  const [isStaffChecking, setIsStaffChecking] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState("");

  // Restore session
  useEffect(() => {
    try {
      const storedAuth = sessionStorage.getItem("scitech_auth_creds");
      const storedUser = sessionStorage.getItem("scitech_user");
      if (storedAuth && storedUser) {
        setAuthCreds(JSON.parse(storedAuth));
        setCurrentUser(JSON.parse(storedUser));
        setIsAdmin(true);
      }
    } catch (err) {
      console.error("Failed to restore session", err);
    }
  }, []);

  // Optimized high-fps scroll listener (zero re-renders during active scrolling)
  useEffect(() => {
    let ticking = false;
    let isShown = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldShow = window.scrollY > 300;
          if (shouldShow !== isShown) {
            isShown = shouldShow;
            setShowScrollTop(shouldShow);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // Fetch Links & Configs (Cache-first / Stale-While-Revalidate for instant render)
  const fetchData = async () => {
    try {
      // 1. Load config from localStorage
      const savedConfig = localStorage.getItem("scitech_admin_config");
      let currentConfig: AdminConfig = {};
      if (savedConfig) {
        try {
          currentConfig = JSON.parse(savedConfig);
        } catch (e) {}
      }
      
      // Default configs if empty
      if (!currentConfig.googleSheetId) currentConfig.googleSheetId = "1pphCw3O30znOqQeyAgYsv9P4M6SRVGFVdn_aDbDqwPY";
      
      const defaultGASUrl = DEFAULT_GAS_URL;
      if (!currentConfig.googleAppsScriptUrl && defaultGASUrl) {
        currentConfig.googleAppsScriptUrl = defaultGASUrl;
        currentConfig.isGoogleSheetSyncEnabled = true;
      }

      const BROKEN_SAMPLE_URL = "https://script.google.com/macros/s/AKfycbzdXp6CR3w67Ulw4ckaexumuYicKEsrnKYJZ7aoZVqcmdRug2ugJncRDmIZPetO-Pw5pg/exec";
      if (currentConfig.googleAppsScriptUrl === BROKEN_SAMPLE_URL) {
        currentConfig.googleAppsScriptUrl = "";
      }
      
      if (currentConfig.isGoogleSheetSyncEnabled === undefined) currentConfig.isGoogleSheetSyncEnabled = !!currentConfig.googleAppsScriptUrl;
      if (!currentConfig.syncInterval) currentConfig.syncInterval = 5;

      // 2. Load Links from localStorage first
      const savedLinks = localStorage.getItem("scitech_links");
      let linkList: Link[] = [];
      if (savedLinks) {
        try {
          const parsed = JSON.parse(savedLinks);
          if (Array.isArray(parsed)) {
            linkList = parsed;
          }
        } catch (e) {}
      }

      // 3. Auto Seed if completely empty
      if (!Array.isArray(linkList) || linkList.length === 0) {
        linkList = DEFAULT_LINKS().map((l, i) => ({
          id: `seed-link-${i}`,
          ...l
        }));
        localStorage.setItem("scitech_links", JSON.stringify(linkList));
      } else {
        linkList = linkList.map(raw => normalizeLink(raw));
      }

      // ⚡ INSTANT RENDER: Present content instantly without waiting for network cold starts!
      setAdminConfig(currentConfig);
      setLinks(linkList);
      setLoading(false);

      // 🔄 ASYNC BACKGROUND SYNC: If Google Apps Script is configured and enabled, refresh in background
      if (currentConfig.googleAppsScriptUrl && currentConfig.isGoogleSheetSyncEnabled) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
        fetch(currentConfig.googleAppsScriptUrl, { signal: controller?.signal, cache: "no-store" })
          .then(res => res.ok ? res.json() : null)
          .then(resJson => {
            if (timeoutId) clearTimeout(timeoutId);
            if (!resJson) return;
            let fetchedLinks: any = null;
            if (Array.isArray(resJson)) {
              fetchedLinks = resJson;
            } else if (resJson.success && Array.isArray(resJson.data)) {
              fetchedLinks = resJson.data;
            }
            if (fetchedLinks && fetchedLinks.length > 0) {
              setLinks(prev => {
                const prevMap = new Map(prev.map(p => [p.id, p]));
                const normalized = fetchedLinks.map((raw: any) => {
                  const id = String(raw.id || raw[0] || '');
                  return normalizeLink(raw, prevMap.get(id));
                });
                if (JSON.stringify(prev) !== JSON.stringify(normalized)) {
                  localStorage.setItem("scitech_links", JSON.stringify(normalized));
                  return normalized;
                }
                return prev;
              });
            }
            if (resJson.settings) {
              let changed = false;
              const merged = { ...currentConfig };
              if (resJson.settings.siteTitle && resJson.settings.siteTitle !== merged.siteTitle) {
                merged.siteTitle = resJson.settings.siteTitle;
                changed = true;
              }
              if (resJson.settings.siteLogoUrl && resJson.settings.siteLogoUrl !== merged.siteLogoUrl) {
                merged.siteLogoUrl = resJson.settings.siteLogoUrl;
                changed = true;
              }
              if (resJson.settings.announcementText !== undefined && resJson.settings.announcementText !== merged.announcementText) {
                merged.announcementText = resJson.settings.announcementText;
                changed = true;
              }
              if (resJson.settings.isAnnouncementActive !== undefined) {
                const isActive = resJson.settings.isAnnouncementActive === true || resJson.settings.isAnnouncementActive === "true";
                if (isActive !== merged.isAnnouncementActive) {
                  merged.isAnnouncementActive = isActive;
                  changed = true;
                }
              }
              if (resJson.settings.staffCodeHashes !== undefined) {
                const hashes = parseStaffCodeHashes(resJson.settings.staffCodeHashes);
                if (JSON.stringify(hashes) !== JSON.stringify(merged.staffCodeHashes || [])) {
                  merged.staffCodeHashes = hashes;
                  changed = true;
                }
              }
              if (resJson.settings.staffPasswords !== undefined) {
                try {
                  const sp = typeof resJson.settings.staffPasswords === "string" ? JSON.parse(resJson.settings.staffPasswords) : resJson.settings.staffPasswords;
                  if (Array.isArray(sp)) {
                    merged.staffPasswords = sp;
                    changed = true;
                  }
                } catch (e) {}
              }
              if (resJson.settings.staffPasswordItems !== undefined) {
                try {
                  const spi = typeof resJson.settings.staffPasswordItems === "string" ? JSON.parse(resJson.settings.staffPasswordItems) : resJson.settings.staffPasswordItems;
                  if (Array.isArray(spi)) {
                    merged.staffPasswordItems = spi;
                    changed = true;
                  }
                } catch (e) {}
              }
              if (changed) {
                localStorage.setItem("scitech_admin_config", JSON.stringify(merged));
                setAdminConfig(merged);
              }
            }
          })
          .catch(err => {
            if (timeoutId) clearTimeout(timeoutId);
            console.warn("Background initial sync notice:", err?.message || err);
          });
      }
    } catch (error) {
      console.error("Error loading local storage data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update site title and favicon based on config
  useEffect(() => {
    if (adminConfig.siteTitle) {
      document.title = adminConfig.siteTitle;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', adminConfig.siteTitle);
      const twitterTitle = document.querySelector('meta[property="twitter:title"]');
      if (twitterTitle) twitterTitle.setAttribute('content', adminConfig.siteTitle);
    }
    if (adminConfig.siteLogoUrl) {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/png';
      link.rel = 'icon';
      link.href = adminConfig.siteLogoUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', adminConfig.siteLogoUrl);
      const twitterImage = document.querySelector('meta[property="twitter:image"]');
      if (twitterImage) twitterImage.setAttribute('content', adminConfig.siteLogoUrl);
    }
  }, [adminConfig.siteTitle, adminConfig.siteLogoUrl]);

  // Handle click counter increment in LocalStorage and sync to Google Sheets
  const handleIncrementClick = useCallback(async (linkId: string) => {
    setLinks(prev => {
      const updated = prev.map(l => l.id === linkId ? { ...l, clickCount: (l.clickCount || 0) + 1 } : l);
      localStorage.setItem("scitech_links", JSON.stringify(updated));
      return updated;
    });

    if (adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      try {
        const { incrementClickViaWebApp } = await import('./googleSheets');
        await incrementClickViaWebApp(adminConfig.googleAppsScriptUrl, linkId);
      } catch (err) {
        console.error("Failed to sync click count to Google Sheets", err);
      }
    }
  }, [adminConfig.isGoogleSheetSyncEnabled, adminConfig.googleAppsScriptUrl]);

  // Admin Methods
  // Checks a username/password against the local admin cache, then the Admins sheet.
  // Returns the account (any role: superadmin, admin or staff) or null.
  const verifyAccount = async (username: string, password: string): Promise<User | null> => {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) return null;

    let localAdmins: (User & { password?: string })[] = [];
    try {
      const stored = localStorage.getItem("scitech_admin_users");
      if (stored) localAdmins = JSON.parse(stored);
    } catch (err) {}

    // Only inject default superadmin on fresh install if NO admin accounts exist at all
    if (localAdmins.length === 0 && !localStorage.getItem("scitech_admin_users_initialized")) {
      const defaultPassword = adminConfig.adminPassword || "admin1234";
      localAdmins.push({ username: "admin", password: defaultPassword, role: "superadmin", pinnedLinks: [] });
      localStorage.setItem("scitech_admin_users", JSON.stringify(localAdmins));
    }

    const matchedLocalUser = localAdmins.find(
      u => u.username.toLowerCase() === trimmedUser.toLowerCase() && u.password === password
    );
    if (matchedLocalUser) {
      return { username: matchedLocalUser.username, role: matchedLocalUser.role, pinnedLinks: matchedLocalUser.pinnedLinks || [] };
    }

    // Not cached here: ask the Admins sheet through Google Apps Script (3.5s timeout)
    if (adminConfig.googleAppsScriptUrl) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      try {
        const response = await fetch(adminConfig.googleAppsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'login', username: trimmedUser, password }),
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        let resData: any = null;
        try { resData = JSON.parse(await response.text()); } catch (e) {}
        if (resData && resData.success && resData.user) {
          // Cache credentials locally for instant subsequent logins
          const updated = [
            ...localAdmins.filter(u => u.username.toLowerCase() !== trimmedUser.toLowerCase()),
            { ...resData.user, password }
          ];
          localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
          return resData.user as User;
        }
      } catch (gasErr) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn("Google Apps Script login check error/timeout:", gasErr);
      }
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const user = await verifyAccount(loginUsername, loginPassword);
      if (!user) {
        setLoginError(lang === "en" ? "Invalid username or password" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      if (user.role === "staff") {
        setLoginError("บัญชีนี้เป็นบัญชีบุคลากร ให้เข้าสู่ระบบที่ปุ่ม \"บุคลากร\" แทน");
        return;
      }
      const credentials = { username: user.username, password: loginPassword };
      setIsAdmin(true);
      setCurrentUser(user);
      setAuthCreds(credentials);
      sessionStorage.setItem("scitech_user", JSON.stringify(user));
      sessionStorage.setItem("scitech_auth_creds", JSON.stringify(credentials));
      setShowAdminModal(false);
      setLoginUsername("");
      setLoginPassword("");
      setShowAdminPanel(true);
    } catch (err: any) {
      setLoginError(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStaffTabClick = () => {
    if (viewMode === "staff") return;

    // Staff links need a code issued by an admin. Logged-in admins skip the code.
    if (isAdmin) {
      setStaffAccountName(currentUser?.username || "แอดมิน");
      setViewMode("staff");
      return;
    }

    const isStaffUnlocked = sessionStorage.getItem("scitech_staff_session") === "true";
    if (isStaffUnlocked) {
      const savedName = sessionStorage.getItem("scitech_staff_name") || "บุคลากร";
      setStaffAccountName(savedName);
      setViewMode("staff");
    } else {
      setShowStaffModal(true);
    }
  };

  // Staff type one password only: the system identifies which account/person it belongs to.
  const checkStaffPassword = async (password: string): Promise<string | null> => {
    const code = password.trim();
    if (!code) return null;

    // 1. Check in staffPasswordItems (assigned by admin with label/name)
    const matchedItem = (adminConfig.staffPasswordItems || []).find(
      i => i.code.trim().toLowerCase() === code.toLowerCase()
    );
    if (matchedItem) {
      return matchedItem.label || "บุคลากร";
    }

    // 2. Check in cached staff users in Admins sheet
    try {
      const cached: (User & { password?: string })[] = JSON.parse(localStorage.getItem("scitech_admin_users") || "[]");
      const matchedUser = cached.find(u => u.password === code);
      if (matchedUser) {
        return matchedUser.username;
      }
    } catch (err) {}

    // 3. Check legacy plain passwords
    if ((adminConfig.staffPasswords || []).some(p => p.trim().toLowerCase() === code.toLowerCase())) {
      return "บุคลากร";
    }

    // 4. Check staff code hashes
    const hash = await hashStaffCode(code);
    if ((adminConfig.staffCodeHashes || []).includes(hash)) {
      return "บุคลากร";
    }

    // 5. Check remote Apps Script
    if (adminConfig.googleAppsScriptUrl) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
      try {
        const response = await fetch(adminConfig.googleAppsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'staffLogin', password: code }),
          signal: controller ? controller.signal : undefined,
        });
        let resData: any = null;
        try { resData = JSON.parse(await response.text()); } catch (e) {}
        if (resData && resData.success) {
          return resData.staffName || "บุคลากร";
        }
      } catch (err) {
        console.warn("Staff password check via Apps Script failed:", err);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }
    return null;
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffLoginError("");
    setIsStaffChecking(true);
    let matchedName: string | null = null;
    try {
      matchedName = await checkStaffPassword(staffPasswordInput);
    } finally {
      setIsStaffChecking(false);
    }
    if (matchedName) {
      sessionStorage.setItem("scitech_staff_session", "true");
      sessionStorage.setItem("scitech_staff_name", matchedName);
      setStaffAccountName(matchedName);
      setShowStaffModal(false);
      setStaffPasswordInput("");
      setStaffLoginError("");
      setViewMode("staff");
    } else {
      setStaffLoginError("รหัสผ่านไม่ถูกต้อง กรุณาติดต่อขอรหัสจากผู้ดูแลระบบ");
    }
  };

  const handleStaffLogout = () => {
    sessionStorage.removeItem("scitech_staff_session");
    sessionStorage.removeItem("scitech_staff_name");
    setStaffAccountName("");
    setViewMode("student");
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setCurrentUser(null);
    setAuthCreds(null);
    sessionStorage.removeItem("scitech_user");
    sessionStorage.removeItem("scitech_auth_creds");
    setShowAdminPanel(false);
  };

  const handleChangePassword = async (newPass: string) => {
    // This is now handled by the SuperAdmin tab in AdminPanel
  };

  const handleUpdateConfig = async (newConfig: typeof adminConfig) => {
    const updated = { ...adminConfig, ...newConfig };
    setAdminConfig(updated);
    localStorage.setItem("scitech_admin_config", JSON.stringify(updated));
    if (updated.isGoogleSheetSyncEnabled && updated.googleAppsScriptUrl && authCreds) {
      try {
        const { saveSettingsViaWebApp } = await import('./googleSheets');
        // Filter only settings to save (e.g. siteTitle, siteLogoUrl)
        // Only send the settings this update touched, so a staff-code change never blanks the site title.
        const settingsToSave: Record<string, string> = {};
        if ("siteTitle" in newConfig) settingsToSave.siteTitle = updated.siteTitle || "";
        if ("siteLogoUrl" in newConfig) settingsToSave.siteLogoUrl = updated.siteLogoUrl || "";
        if ("announcementText" in newConfig) settingsToSave.announcementText = updated.announcementText || "";
        if ("isAnnouncementActive" in newConfig) settingsToSave.isAnnouncementActive = String(!!updated.isAnnouncementActive);
        if (newConfig.staffCodeHashes) {
          settingsToSave.staffCodeHashes = JSON.stringify(newConfig.staffCodeHashes);
        }
        if (Object.keys(settingsToSave).length > 0) {
          await saveSettingsViaWebApp(updated.googleAppsScriptUrl, settingsToSave, authCreds);
        }
      } catch (err) {
        console.error("Failed to sync settings to Google Sheets", err);
      }
    }
  };

  // Staff codes created before codes were shared through the sheet live only in this
  // admin's browser. Publish their hashes once an admin is signed in so staff can use them anywhere.
  const publishedStaffHashes = React.useRef("");
  useEffect(() => {
    const localCodes = (adminConfig.staffPasswords || []).filter(c => c.trim());
    if (!isAdmin || !authCreds || localCodes.length === 0) return;
    let cancelled = false;
    Promise.all(localCodes.map(hashStaffCode)).then(hashes => {
      const known = adminConfig.staffCodeHashes || [];
      const missing = hashes.filter(h => !known.includes(h));
      const attempt = missing.sort().join(",");
      if (!cancelled && missing.length > 0 && publishedStaffHashes.current !== attempt) {
        publishedStaffHashes.current = attempt;
        handleUpdateConfig({ staffCodeHashes: [...known, ...missing] });
      }
    });
    return () => { cancelled = true; };
  }, [isAdmin, authCreds, adminConfig.staffPasswords, adminConfig.staffCodeHashes]);

  // Realtime Polling from Google Apps Script Web App
  useEffect(() => {
    if (adminConfig.googleAppsScriptUrl && adminConfig.isGoogleSheetSyncEnabled) {
      let isMounted = true;
      let isFetching = false;
      let failureCount = 0;

      const fetchFromSheet = async () => {
        if (!isMounted || !adminConfig.googleAppsScriptUrl) return;

        // Exponential backoff if the endpoint is failing/unreachable
        if (failureCount >= 3 && failureCount % 6 !== 0) {
          failureCount++;
          return;
        }

        // Skip background tabs; the visibility listener below refreshes on return
        if (typeof document !== "undefined" && document.hidden) return;
        if (isFetching) return;
        isFetching = true;
        const startedAt = Date.now();

        try {
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

          const res = await fetch(adminConfig.googleAppsScriptUrl, {
            signal: controller ? controller.signal : undefined,
            cache: "no-store",
          });
          if (timeoutId) clearTimeout(timeoutId);

          if (res.ok) {
            failureCount = 0; // Reset on successful fetch
            const responseData = await res.json().catch(() => null);
            if (!responseData) return;

            // A local edit may still be in flight to the sheet; don't overwrite it with stale data
            if (getLastWriteAt() > startedAt - WRITE_SETTLE_MS) return;

            // Handle both array directly and {success: true, data: [...]}
            let fetchedLinks: any = null;
            if (Array.isArray(responseData)) {
              fetchedLinks = responseData;
            } else if (responseData && responseData.success && Array.isArray(responseData.data)) {
              fetchedLinks = responseData.data;
              
              if (responseData.settings && isMounted) {
                setAdminConfig(prev => {
                  const merged = { ...prev };
                  let changed = false;
                  if (responseData.settings.siteTitle !== undefined && responseData.settings.siteTitle !== prev.siteTitle) {
                    merged.siteTitle = responseData.settings.siteTitle;
                    changed = true;
                  }
                  if (responseData.settings.siteLogoUrl !== undefined && responseData.settings.siteLogoUrl !== prev.siteLogoUrl) {
                    merged.siteLogoUrl = responseData.settings.siteLogoUrl;
                    changed = true;
                  }
                  if (responseData.settings.announcementText !== undefined && responseData.settings.announcementText !== prev.announcementText) {
                    merged.announcementText = responseData.settings.announcementText;
                    changed = true;
                  }
                  if (responseData.settings.isAnnouncementActive !== undefined) {
                    const activeVal = responseData.settings.isAnnouncementActive === true || responseData.settings.isAnnouncementActive === "true";
                    if (activeVal !== prev.isAnnouncementActive) {
                      merged.isAnnouncementActive = activeVal;
                      changed = true;
                    }
                  }
                  if (responseData.settings.staffCodeHashes !== undefined) {
                    const hashes = parseStaffCodeHashes(responseData.settings.staffCodeHashes);
                    if (JSON.stringify(hashes) !== JSON.stringify(prev.staffCodeHashes || [])) {
                      merged.staffCodeHashes = hashes;
                      changed = true;
                    }
                  }
                  if (responseData.settings.staffPasswords !== undefined) {
                    try {
                      const sp = typeof responseData.settings.staffPasswords === "string" ? JSON.parse(responseData.settings.staffPasswords) : responseData.settings.staffPasswords;
                      if (Array.isArray(sp)) {
                        merged.staffPasswords = sp;
                        changed = true;
                      }
                    } catch (e) {}
                  }
                  if (responseData.settings.staffPasswordItems !== undefined) {
                    try {
                      const spi = typeof responseData.settings.staffPasswordItems === "string" ? JSON.parse(responseData.settings.staffPasswordItems) : responseData.settings.staffPasswordItems;
                      if (Array.isArray(spi)) {
                        merged.staffPasswordItems = spi;
                        changed = true;
                      }
                    } catch (e) {}
                  }
                  if (changed) {
                    localStorage.setItem("scitech_admin_config", JSON.stringify(merged));
                    return merged;
                  }
                  return prev;
                });
              }
            }

            if (fetchedLinks && isMounted) {
              setLinks(prev => {
                const prevMap = new Map(prev.map(p => [p.id, p]));
                const normalized = fetchedLinks.map((raw: any, idx: number) => {
                  const id = String(raw.id || raw[0] || '');
                  const item = normalizeLink(raw, prevMap.get(id));
                  if (item.order === undefined) {
                    item.order = idx + 1;
                  }
                  return item;
                });
                const isSame = JSON.stringify(prev) === JSON.stringify(normalized);
                if (!isSame) {
                  localStorage.setItem("scitech_links", JSON.stringify(normalized));
                  return normalized;
                }
                return prev;
              });
            }
          } else {
            failureCount++;
            console.warn(`Sync request to Apps Script returned status ${res.status}`);
          }
        } catch (err: any) {
          failureCount++;
          // Quietly handle network or CORS restrictions so third-party URLs do not cause fatal errors
          console.warn("Could not sync from Google Apps Script Web App URL:", err?.message || err);
        } finally {
          isFetching = false;
        }
      };

      fetchFromSheet(); // Initial fetch
      
      const intervalMs = Math.max(adminConfig.syncInterval || 5, 5) * 1000;
      const interval = setInterval(fetchFromSheet, intervalMs);
      const onVisible = () => {
        if (!document.hidden) fetchFromSheet();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onVisible);
      return () => {
        isMounted = false;
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onVisible);
      };
    }
  }, [adminConfig.googleAppsScriptUrl, adminConfig.isGoogleSheetSyncEnabled, adminConfig.syncInterval]);

  // CRUD Links
  const handleAddLink = async (newLinkData: Omit<Link, "id" | "clickCount" | "createdAt">) => {
    const fullLink: Link = {
      ...newLinkData,
      id: `link-${Date.now()}`,
      clickCount: 0,
      createdAt: new Date().toISOString(),
      order: links.length + 1,
    };
    setLinks(prev => {
      const updated = [...prev, fullLink];
      localStorage.setItem("scitech_links", JSON.stringify(updated));
      return updated;
    });
    
    if (adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      import('./googleSheets').then(({ sendActionToWebApp }) => {
        sendActionToWebApp(adminConfig.googleAppsScriptUrl!, 'add', { link: fullLink });
      });
    }
  };

  const handleUpdateLink = async (id: string, updates: Partial<Link>) => {
    let fullUpdatedLink: Link | null = null;
    
    // Pre-resolve current link from state or localStorage
    const currentList: Link[] = links.length > 0 ? links : JSON.parse(localStorage.getItem("scitech_links") || "[]");
    const existing = currentList.find(l => l.id === id);
    if (existing) {
      fullUpdatedLink = { ...existing, ...updates };
    }

    setLinks(prev => {
      const updated = prev.map(l => {
        if (l.id === id) {
          const item = { ...l, ...updates };
          fullUpdatedLink = item;
          return item;
        }
        return l;
      });
      localStorage.setItem("scitech_links", JSON.stringify(updated));
      return updated;
    });
    
    if (fullUpdatedLink && adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      const targetLink = fullUpdatedLink;
      import('./googleSheets').then(({ sendActionToWebApp }) => {
        sendActionToWebApp(adminConfig.googleAppsScriptUrl!, 'update', { link: targetLink }, authCreds || undefined);
      });
    }
  };


  const handleDeleteLink = async (id: string) => {
    setLinks(prev => {
      const updated = prev.filter(l => l.id !== id);
      localStorage.setItem("scitech_links", JSON.stringify(updated));
      return updated;
    });
    
    if (adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      import('./googleSheets').then(({ sendActionToWebApp }) => {
        sendActionToWebApp(adminConfig.googleAppsScriptUrl!, 'delete', { id }, authCreds || undefined);
      });
    }
  };

  const handleReorderLinks = async (reorderedLinks: Link[]) => {
    const updated = reorderedLinks.map((link, idx) => ({
      ...link,
      order: idx + 1,
    }));
    setLinks(updated);
    try {
      localStorage.setItem("scitech_links", JSON.stringify(updated));
    } catch {}

    if (adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      import('./googleSheets').then(({ syncViaWebApp }) => {
        syncViaWebApp(adminConfig.googleAppsScriptUrl!, updated, authCreds || undefined);
      });
    }
  };

  // Display Links: In English mode, dynamic titles and descriptions are automatically translated
  const displayLinks = useMemo(() => {
    if (lang === "th") return links;
    return links.map(link => {
      if (!link) return link;
      const tInfo = translatedLinksMap[link.id];
      if (tInfo) {
        return {
          ...link,
          title: tInfo.title,
          description: tInfo.description ?? link.description,
        };
      }
      const titleText = typeof link.title === "string" ? link.title.trim() : String(link.title || "").trim();
      const descText = typeof link.description === "string" ? link.description.trim() : (link.description ? String(link.description).trim() : "");
      const glossaryTitle = ACADEMIC_GLOSSARY[titleText];
      const glossaryDesc = descText ? ACADEMIC_GLOSSARY[descText] : undefined;
      return {
        ...link,
        title: glossaryTitle || link.title,
        description: glossaryDesc || link.description,
      };
    });
  }, [links, lang, translatedLinksMap]);

  // Category counts based on viewMode
  const categoryCounts = useMemo(() => {
    const available = displayLinks.filter(l => {
      const aud = l.targetAudience || (l.isStaffOnly ? 'staff' : 'both');
      if (viewMode === "student" && aud === "staff") return false;
      if (viewMode === "staff" && aud === "student") return false;
      return true;
    });
    return {
      all: available.length,
      university: available.filter(l => (l.category || 'faculty') === 'university').length,
      faculty: available.filter(l => (l.category || 'faculty') === 'faculty').length,
    };
  }, [displayLinks, viewMode]);

  // Filtering Logic
  const filteredLinks = useMemo(() => {
    const filtered = displayLinks.filter(link => {
      const aud = link.targetAudience || (link.isStaffOnly ? 'staff' : 'both');

      // 1. Audience Filter
      if (viewMode === "student") {
        // Students see student-only and both (hide staff-only links)
        if (aud === "staff") {
          return false;
        }
      } else if (viewMode === "staff") {
        // Staff see staff-only and both (hide student-only links that don't target staff)
        if (aud === "student") {
          return false;
        }
      }

      // 2. Category Filter
      const cat = link.category || 'faculty';
      if (selectedCategory !== "all" && cat !== selectedCategory) {
        return false;
      }

      // 3. Search Filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchSearch = 
        link.title.toLowerCase().includes(q) ||
        (link.description && link.description.toLowerCase().includes(q)) ||
        link.url.toLowerCase().includes(q);
      
      return matchSearch;
    });

    return filtered.sort((a, b) => {
      // Logic for sorting pins: if admin is logged in, their personal pins override or add to global pins
      const currentUserPins = currentUser?.pinnedLinks || [];
      const aIsPinned = a.isPinned || (isAdmin && currentUserPins.includes(a.id));
      const bIsPinned = b.isPinned || (isAdmin && currentUserPins.includes(b.id));

      // Pinned items first
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      // Custom order set by admin
      const aOrder = typeof a.order === 'number' ? a.order : undefined;
      const bOrder = typeof b.order === 'number' ? b.order : undefined;
      if (aOrder !== undefined && bOrder !== undefined) {
        if (aOrder !== bOrder) return aOrder - bOrder;
      } else if (aOrder !== undefined) {
        return -1;
      } else if (bOrder !== undefined) {
        return 1;
      }

      // Fallback: position in links array
      const idxA = links.findIndex(l => l.id === a.id);
      const idxB = links.findIndex(l => l.id === b.id);
      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
        return idxA - idxB;
      }

      // Then by creation date (newest first, or keep default order)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [displayLinks, searchQuery, viewMode, selectedCategory, currentUser, isAdmin, links]);

  // Personal pins: kept in this browser only, so every visitor has their own list.
  const [myPins, setMyPins] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("scitech_my_pins") || "[]");
      return Array.isArray(saved) ? saved.map(String) : [];
    } catch {
      return [];
    }
  });

  const toggleMyPin = useCallback((id: string) => {
    setMyPins(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      try {
        localStorage.setItem("scitech_my_pins", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const myPinnedLinks = useMemo(
    () => (myPins || [])
      .map(id => displayLinks.find(l => l && l.id === id))
      .filter((l): l is Link => {
        if (!l) return false;
        const aud = l.targetAudience || (l.isStaffOnly ? 'staff' : 'both');
        if (viewMode === "student" && aud === "staff") return false;
        if (viewMode === "staff" && aud === "student") return false;
        return true;
      }),
    [myPins, displayLinks, viewMode]
  );

  // Bento order: preserve sequence from filteredLinks, with pinned items highlighted as wide cards
  const bentoItems = useMemo(() => {
    return filteredLinks.map(link => ({
      link,
      variant: (link.isPinned ? "wide" : "small") as BentoVariant,
      rank: undefined as number | undefined,
    }));
  }, [filteredLinks]);

  return (
    <div className="min-h-screen bg-[#f3f0ef] dark:bg-[#121113] text-[#1f1a1c] dark:text-[#f3f0ef] flex flex-col font-sans selection:bg-[#5c0620]/20 selection:text-[#5c0620] dark:selection:bg-rose-500/30 dark:selection:text-rose-200 relative overflow-x-clip transition-colors duration-200">

      {adminConfig.isAnnouncementActive && adminConfig.announcementText && (
        <div className="relative z-20 bg-[#3a0210] dark:bg-[#20040b] text-white px-4 py-2.5 text-center text-sm font-medium border-b border-rose-900/30">
          {adminConfig.announcementText}
        </div>
      )}

      <main className="max-w-6xl mx-auto w-full px-4 md:px-6 pt-4 md:pt-7 pb-10 flex-1 flex flex-col gap-3 md:gap-4 relative z-10">

        {/* Top bar: brand, audience switch, theme toggle & admin */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 font-bold text-[16px] md:text-[17px]">
            {adminConfig.siteLogoUrl ? (
              <img src={adminConfig.siteLogoUrl} alt="" className="w-9 h-9 rounded-full object-contain bg-white dark:bg-[#252125]" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-[#5c0620] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" aria-hidden="true" />
              </span>
            )}
            <span className="text-[#1f1a1c] dark:text-white">{adminConfig.siteTitle || "FST Link Hub"}</span>
          </div>

          <div className="flex items-center gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div role="group" aria-label="กลุ่มผู้ใช้" className="grid grid-cols-2 gap-1 bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-full p-1 w-full sm:w-auto shadow-xs">
              <button
                type="button"
                aria-pressed={viewMode === "student"}
                onClick={() => setViewMode("student")}
                className={`px-5 min-h-11 rounded-full text-[15px] font-semibold transition-colors cursor-pointer ${viewMode === "student" ? "bg-[#1f1a1c] dark:bg-white text-white dark:text-[#1f1a1c]" : "text-[#4a4245] dark:text-slate-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c]"}`}
              >
                {lang === "en" ? "Students" : "นักศึกษา"}
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "staff"}
                onClick={handleStaffTabClick}
                className={`px-5 min-h-11 rounded-full text-[15px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${viewMode === "staff" ? "bg-[#5c0620] text-white" : "text-[#4a4245] dark:text-slate-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c]"}`}
              >
                {viewMode !== "staff" && <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{lang === "en" ? "Staff" : "บุคลากร"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher with National Flags */}
            <div role="group" aria-label="เปลี่ยนภาษา / Switch Language" className="flex items-center bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-full p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setLang("th")}
                aria-pressed={lang === "th"}
                className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  lang === "th"
                    ? "bg-[#5c0620] text-white shadow-xs"
                    : "text-[#4a4245] dark:text-slate-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c]"
                }`}
                title="เปลี่ยนเป็นภาษาไทย (TH)"
              >
                <span className="text-sm">🇹🇭</span>
                <span>TH</span>
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  lang === "en"
                    ? "bg-[#5c0620] text-white shadow-xs"
                    : "text-[#4a4245] dark:text-slate-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c]"
                }`}
                title="Switch to English (EN) - ระบบแปลอัตโนมัติ"
              >
                <span className="text-sm">🇬🇧</span>
                <span>EN</span>
              </button>
            </div>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? (lang === "en" ? "Switch to Light Mode" : "เปลี่ยนเป็นโหมดสว่าง") : (lang === "en" ? "Switch to Dark Mode" : "เปลี่ยนเป็นโหมดมืด")}
              title={theme === "dark" ? (lang === "en" ? "Switch to Light Mode" : "เปลี่ยนเป็นโหมดสว่าง (Light Mode)") : (lang === "en" ? "Switch to Dark Mode" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)")}
              className="w-11 h-11 rounded-full bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 flex items-center justify-center text-[#4a4245] dark:text-amber-400 hover:text-[#5c0620] dark:hover:text-amber-300 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 transition-transform" />
              )}
            </button>

            {isAdmin ? (
              <div className="flex items-center gap-1 bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-full p-1 shadow-xs">
                <button type="button" onClick={() => setShowAdminPanel(true)} className="flex items-center gap-1.5 px-4 min-h-10 rounded-full text-sm font-semibold text-[#5c0620] dark:text-rose-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c] cursor-pointer">
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{lang === "en" ? "Admin Panel" : "จัดการข้อมูล"}</span>
                </button>
                <button type="button" onClick={handleLogout} aria-label={lang === "en" ? "Sign Out" : "ออกจากระบบแอดมิน"} title={lang === "en" ? "Sign Out" : "ออกจากระบบแอดมิน"} className="w-10 h-10 rounded-full flex items-center justify-center text-[#4a4245] dark:text-slate-300 hover:bg-[#f3f0ef] dark:hover:bg-[#2c272c] cursor-pointer">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAdminModal(true)} aria-label={lang === "en" ? "Admin Login" : "เข้าสู่ระบบผู้ดูแล"} title={lang === "en" ? "Admin Login" : "เข้าสู่ระบบผู้ดูแล"} className="w-11 h-11 rounded-full bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 flex items-center justify-center text-[#1f1a1c] dark:text-slate-200 hover:text-[#5c0620] dark:hover:text-rose-400 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95">
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Staff Mode Status Banner */}
        {viewMode === "staff" && (
          <div className="bg-white dark:bg-[#1e1b1e] rounded-2xl p-3.5 md:px-5 md:py-3.5 border border-[#5c0620]/20 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#5c0620] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Briefcase className="w-5 h-5" />
              </span>
              <div>
                <div className="font-bold text-sm md:text-[15px] text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400 font-normal">{lang === "en" ? "Signed in as:" : "เข้าสู่ระบบในชื่อ:"}</span>
                  <span className="text-[#5c0620] dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/40 px-2.5 py-0.5 rounded-lg font-bold">
                    {isAdmin ? (currentUser?.username || (lang === "en" ? "Administrator" : "ผู้ดูแลระบบ")) : (staffAccountName || (lang === "en" ? "Staff" : "บุคลากร"))}
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                    {lang === "en" ? "Staff Portal" : "โหมดบุคลากร (Staff Portal)"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === "en"
                    ? `Showing staff and general systems (student-only hidden) · ${filteredLinks.length} matching systems`
                    : `แสดงเฉพาะระบบสำหรับบุคลากรและระบบทั่วไป (ซ่อนระบบเฉพาะนักศึกษาอัตโนมัติ) · ${filteredLinks.length} รายการที่ตรงกับสิทธิ์`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={handleStaffLogout}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-white/10 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 font-semibold self-stretch sm:self-auto justify-center"
                title={lang === "en" ? "Exit Staff Mode" : "ออกจากโหมดบุคลากร"}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Exit Mode" : "ออกจากโหมดนี้"}</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 grid-flow-dense">

          {/* Hero: greeting + search */}
          <div className="col-span-2 bg-[#5c0620] dark:bg-[#480518] text-white rounded-[24px] md:rounded-[28px] p-5 md:p-8 flex flex-col justify-between gap-5 md:gap-7 min-h-[200px] md:min-h-[260px] shadow-sm">
            <div>
              <div className="text-[13px] md:text-[14px] text-[#f6d9e0] dark:text-rose-200/80">
                {lang === "en" ? "Faculty of Science and Technology" : "คณะวิทยาศาสตร์และเทคโนโลยี"}
              </div>
              <h1 className="mt-1 text-[26px] md:text-[38px] leading-tight font-bold">
                {lang === "en" ? "Which system do you need today?" : "วันนี้ต้องใช้ระบบไหน?"}
              </h1>
            </div>
            <div className="relative">
              <label htmlFor="link-search" className="sr-only">{lang === "en" ? "Search links" : "ค้นหาลิงก์"}</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5c0620] dark:text-rose-400 pointer-events-none" aria-hidden="true" />
              <input
                id="link-search"
                type="search"
                placeholder={lang === "en" ? "Search systems e.g. Grades, Petitions, Wi-Fi..." : "พิมพ์ชื่อระบบ เช่น เกรด, คำร้อง, Wi‑Fi"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 min-h-[52px] md:min-h-14 bg-white dark:bg-[#1a1418] text-[#1f1a1c] dark:text-white placeholder-[#7a7074] dark:placeholder-slate-400 border border-transparent dark:border-white/10 rounded-2xl text-[16px] focus:outline-none focus:ring-4 focus:ring-white/40"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label={lang === "en" ? "Clear search" : "ล้างคำค้นหา"} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[#5e5558] dark:text-slate-400 hover:text-[#1f1a1c] dark:hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* My pins: saved per browser, so each visitor has their own */}
          <section aria-labelledby="my-pins-title" className="col-span-2 bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-[24px] md:rounded-[28px] p-4 md:p-6 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 id="my-pins-title" className="text-[15px] md:text-[16px] font-bold flex items-center gap-2 text-[#1f1a1c] dark:text-white">
                <Pin className="w-4 h-4 text-[#5c0620] dark:text-rose-400" aria-hidden="true" />
                {lang === "en" ? "My Pins" : "หมุดของฉัน"}
              </h2>
              {myPinnedLinks.length > 0 && <span className="text-[13px] text-[#5e5558] dark:text-slate-400">{myPinnedLinks.length} {lang === "en" ? "items" : "รายการ"}</span>}
            </div>
            {myPinnedLinks.length === 0 ? (
              <p className="text-[14px] text-[#5e5558] dark:text-slate-400 leading-relaxed">
                {lang === "en" ? (
                  <>Click the <Pin className="inline w-4 h-4 align-[-2px] text-[#5c0620] dark:text-rose-400" aria-label="Pin" /> button on frequently used systems to pin them here. Pins are saved on your device only.</>
                ) : (
                  <>กดปุ่ม <Pin className="inline w-4 h-4 align-[-2px] text-[#5c0620] dark:text-rose-400" aria-label="หมุด" /> บนการ์ดเว็บที่ใช้บ่อย แล้วเว็บนั้นจะมาอยู่ตรงนี้ หมุดเก็บไว้ในเครื่องของคุณเอง คนอื่นไม่เห็น</>
                )}
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {myPinnedLinks.map((link, idx) => (
                  <li key={link.id} className="relative flex items-center gap-3 rounded-2xl bg-[#f3f0ef] dark:bg-[#292429] pl-2 pr-1 py-1.5 hover:bg-[#ebe6e4] dark:hover:bg-[#342e34] transition-colors">
                    {link.thumbnailUrl ? (
                      <img src={link.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <SiteIcon link={link} index={idx} size={40} radius={12} />
                    )}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleIncrementClick(link.id)}
                      className="flex-1 min-w-0 text-[14px] font-semibold text-[#1f1a1c] dark:text-slate-100 truncate after:absolute after:inset-0 after:content-['']"
                    >
                      {link.title}
                    </a>
                    <button type="button" onClick={() => toggleMyPin(link.id)} aria-label={lang === "en" ? `Remove ${link.title} from pins` : `เอา ${link.title} ออกจากหมุดของฉัน`} title={lang === "en" ? "Remove" : "เอาออก"} className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-[#5e5558] dark:text-slate-400 hover:text-[#5c0620] dark:hover:text-rose-400 hover:bg-white dark:hover:bg-[#1e1b1e] cursor-pointer shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Category Filter Bar */}
          <div className="col-span-2 lg:col-span-4 flex items-center justify-between gap-3 flex-wrap pt-1 pb-1">
            <div role="group" aria-label="หมวดหมู่ของระบบ" className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                aria-pressed={selectedCategory === "all"}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  selectedCategory === "all"
                    ? "bg-[#1f1a1c] dark:bg-white text-white dark:text-[#1f1a1c] shadow-xs"
                    : "bg-white dark:bg-[#1e1b1e] text-[#5e5558] dark:text-slate-300 hover:bg-[#eae5e3] dark:hover:bg-[#2c272c] border border-transparent dark:border-white/10"
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>{lang === "en" ? "All Systems" : "ทั้งหมด"}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedCategory === "all" ? "bg-white/20 dark:bg-black/20 text-white dark:text-slate-900" : "bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300"}`}>
                  {categoryCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("university")}
                aria-pressed={selectedCategory === "university"}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  selectedCategory === "university"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white dark:bg-[#1e1b1e] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-transparent dark:border-white/10"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{lang === "en" ? "University Systems" : "ระบบสำหรับมหาวิทยาลัย"}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedCategory === "university" ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"}`}>
                  {categoryCounts.university}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("faculty")}
                aria-pressed={selectedCategory === "faculty"}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  selectedCategory === "faculty"
                    ? "bg-[#5c0620] text-white shadow-xs"
                    : "bg-white dark:bg-[#1e1b1e] text-[#5c0620] dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent dark:border-white/10"
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                <span>{lang === "en" ? "Faculty Systems" : "ระบบสำหรับคณะวิทยาศาสตร์"}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedCategory === "faculty" ? "bg-white/20 text-white" : "bg-rose-50 dark:bg-rose-950/40 text-[#5c0620] dark:text-rose-300"}`}>
                  {categoryCounts.faculty}
                </span>
              </button>
            </div>

            <div className="text-xs text-[#5e5558] dark:text-slate-400 font-medium hidden sm:block">
              {filteredLinks.length} {lang === "en" ? "systems available" : "ระบบที่พร้อมใช้งาน"}
            </div>
          </div>

          {searchQuery && (
            <p className="col-span-2 lg:col-span-4 text-[14px] text-[#4a4245] dark:text-slate-300 px-1 pt-2" aria-live="polite">
              {lang === "en" ? "Search results for “" : "ผลการค้นหา “"}
              <strong className="text-[#5c0620] dark:text-rose-400">{searchQuery}</strong>
              {lang === "en" ? `” (${filteredLinks.length} items)` : `” ${filteredLinks.length} รายการ`}
            </p>
          )}

          {loading ? (
            <div className="col-span-2 lg:col-span-4 py-20 text-center bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-[28px]">
              <Loader2 className="w-9 h-9 animate-spin text-[#5c0620] dark:text-rose-400 mx-auto" />
              <p className="mt-3 text-sm text-[#5e5558] dark:text-slate-400">
                {lang === "en" ? "Loading systems..." : "กำลังโหลดลิงก์..."}
              </p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="col-span-2 lg:col-span-4 py-16 px-6 text-center bg-white dark:bg-[#1e1b1e] border border-transparent dark:border-white/10 rounded-[28px] space-y-3">
              <Globe className="w-11 h-11 text-[#c9c1c4] dark:text-slate-600 mx-auto" aria-hidden="true" />
              <h2 className="font-bold text-[17px] text-[#1f1a1c] dark:text-white">
                {lang === "en" ? "No systems found matching your search" : "ไม่พบลิงก์ที่ตรงกับคำค้นหา"}
              </h2>
              <p className="text-[14px] text-[#5e5558] dark:text-slate-400">
                {lang === "en" ? "Try different keywords or view all systems" : "ลองใช้คำอื่น หรือดูลิงก์ทั้งหมด"}
              </p>
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="text-sm font-semibold bg-[#1f1a1c] dark:bg-white text-white dark:text-[#1f1a1c] px-5 min-h-11 rounded-full cursor-pointer hover:opacity-90">
                  {lang === "en" ? "View all systems" : "ดูลิงก์ทั้งหมด"}
                </button>
              )}
            </div>
          ) : (
            bentoItems.map(({ link, variant, rank }, idx) => (
              <BentoCard
                key={link.id}
                link={link}
                variant={variant}
                rank={rank}
                index={idx}
                isMyPin={myPins.includes(link.id)}
                isAdmin={isAdmin}
                lang={lang}
                onTogglePin={toggleMyPin}
                onIncrementClick={handleIncrementClick}
                onEdit={() => setShowAdminPanel(true)}
                onDelete={handleDeleteLink}
              />
            ))
          )}
        </div>
      </main>

      {/* 3. APP FOOTER */}
      <footer className="bg-white dark:bg-[#161416] text-slate-600 dark:text-slate-400 mt-6 md:mt-10 border-t border-[#e4dfdd] dark:border-white/10 relative z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Col 1: About Faculty */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
              <GraduationCap className="w-6 h-6 text-[#5c0620] dark:text-rose-400" />
              <span className="font-extrabold text-base tracking-tight">
                {lang === "en" ? "Faculty of Science and Technology" : "คณะวิทยาศาสตร์และเทคโนโลยี"}
              </span>
            </div>
            <p className="text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
              {lang === "en"
                ? "Dedicated to cultivating knowledge, research excellence, and technological workforce in science, IT, and emerging innovations for sustainable society and progress."
                : "มุ่งเน้นการสร้างสรรค์องค์ความรู้ งานวิจัย และพัฒนากำลังคนด้านวิทยาศาสตร์ ไอที และเทคโนโลยี เพื่อการพัฒนาสังคมและเศรษฐกิจที่ยั่งยืน"}
            </p>
          </div>

          {/* Col 2: Contact Info */}
          <div className="space-y-3.5">
            <h4 className="text-slate-800 dark:text-white font-bold text-sm tracking-tight">
              {lang === "en" ? "Contact Information" : "ช่องทางการติดต่อคณะ"}
            </h4>
            <ul className="text-xs space-y-3 font-medium text-slate-500 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#5c0620] dark:text-rose-400 shrink-0" />
                <span>
                  {lang === "en" ? "Faculty of Science and Technology Building, Fatoni University" : "อาคารคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยฟัตตอนี"}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#5c0620] dark:text-rose-400 shrink-0" />
                <span>scitech@ftu.ac.th</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Disclaimer & System info */}
          <div className="space-y-3.5">
            <h4 className="text-slate-800 dark:text-white font-bold text-sm tracking-tight">
              {lang === "en" ? "Administration & Portal Management" : "ผู้ดูแลระบบและจัดการข้อมูล"}
            </h4>
            <p className="text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400 mb-4">
              {lang === "en"
                ? "Access backend console to manage links, users, categories, and real-time statistics."
                : "เข้าสู่ระบบหลังบ้านเพื่อจัดการพอร์ทัลลิงก์ สำหรับเจ้าหน้าที่และบุคลากร"}
            </p>
            {isAdmin ? (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="text-xs bg-[#5c0620] hover:bg-[#881337] text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Open Admin Control Panel" : "เปิดแผงควบคุมระบบ (Admin Control)"}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                className="text-xs bg-white dark:bg-[#252125] hover:bg-slate-50 dark:hover:bg-[#302a30] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {lang === "en" ? "Admin Login" : "เข้าสู่หลังบ้านแอดมิน"}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Credits Line */}
        <div className="border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 py-4">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
            <p>&copy; {new Date().getFullYear()} Faculty of Science and Technology. All Rights Reserved.</p>
            <p className="mt-1 md:mt-0">Designed & Developed by FST IT Team</p>
          </div>
        </div>
      </footer>

      {/* Floating Scroll-To-Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-40 p-3.5 bg-white/90 dark:bg-[#252125]/90 hover:bg-white dark:hover:bg-[#2e292e] text-[#5c0620] dark:text-rose-400 hover:text-[#3a0210] dark:hover:text-rose-300 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-white/80 dark:border-white/10 backdrop-blur-xl transition-all cursor-pointer group hover:scale-105 active:scale-95"
            title="เลื่อนขึ้นด้านบนสุด"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 4. MODAL: ADMIN LOGIN */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-[#1e1b1e] backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] max-w-md w-full p-6 border border-white dark:border-white/10 relative space-y-5">
            <button 
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-white dark:bg-[#2a252a] text-[#5c0620] dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-white dark:border-white/10">
                <Lock className="w-6 h-6 text-[#5c0620] dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {lang === "en" ? "Administrator Sign In" : "เข้าสู่ระบบ (Admin Login)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === "en" ? "Sign in to manage the link portal" : "กรุณาเข้าสู่ระบบเพื่อจัดการพอร์ทัลลิงก์"}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === "en" ? "Username" : "ชื่อผู้ใช้งาน (Username)"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === "en" ? "Enter Username" : "ป้อน Username"}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner bg-white dark:bg-[#292429] focus:outline-hidden focus:ring-4 focus:ring-[#5c0620]/20 focus:border-[#5c0620]/40 text-sm text-slate-800 dark:text-white placeholder-slate-400 transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === "en" ? "Password" : "รหัสผ่าน (Password)"}
                </label>
                <input
                  type="password"
                  required
                  placeholder={lang === "en" ? "Enter Password" : "ป้อนรหัสผ่าน"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner bg-white dark:bg-[#292429] focus:outline-hidden focus:ring-4 focus:ring-[#5c0620]/20 focus:border-[#5c0620]/40 text-sm font-mono text-slate-800 dark:text-white placeholder-slate-400 transition-all"
                />
              </div>

              {loginError && (
                <p className="text-xs text-[#881337] dark:text-rose-400 font-semibold text-center flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{loginError}</span>
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 py-2.5 bg-[#5c0620] hover:bg-[#881337] text-white shadow-sm text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === "en" ? "Signing In..." : "กำลังเข้าสู่ระบบ"}</span>
                    </>
                  ) : (
                    <>
                      {lang === "en" ? "Sign In" : "เข้าสู่ระบบ"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF ACCESS MODAL */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1e1b1e] p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-xl border border-white dark:border-white/10">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center rounded-2xl mb-4">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center">
                {lang === "en" ? "Staff Access Portal" : "เข้าใช้งานหมวดหมู่บุคลากร"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 px-4">
                {lang === "en" ? "Enter the staff passcode provided by faculty admins" : "กรอกรหัสที่ได้รับจากแอดมินของคณะ"}
              </p>
            </div>
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label htmlFor="staff-password" className="sr-only">
                  {lang === "en" ? "Staff Passcode" : "รหัสบุคลากร"}
                </label>
                <input
                  id="staff-password"
                  type="password"
                  placeholder={lang === "en" ? "Staff Passcode" : "รหัสบุคลากร"}
                  autoComplete="current-password"
                  autoFocus
                  value={staffPasswordInput}
                  onChange={(e) => setStaffPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm bg-slate-50 dark:bg-[#292429] text-slate-800 dark:text-white placeholder-slate-400 transition-all text-center tracking-widest font-mono"
                />
              </div>
              {staffLoginError && (
                <p className="text-rose-500 dark:text-rose-400 text-xs font-semibold text-center">{staffLoginError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  disabled={isStaffChecking}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white shadow-sm text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  {isStaffChecking
                    ? (lang === "en" ? "Checking..." : "กำลังตรวจสอบ...")
                    : (lang === "en" ? "Sign In" : "เข้าสู่ระบบ")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADMIN CONTROL PANEL (CRUD WORKSPACE) - LAZY LOADED */}
      {showAdminPanel && (
        <React.Suspense fallback={null}>
          <AdminPanel
            isOpen={showAdminPanel}
            onClose={() => {
              setShowAdminPanel(false);
              // Re-fetch data on close to ensure UI matches any edits made in Panel
              fetchData();
            }}
            links={links}
            currentUser={currentUser}
            authCreds={authCreds}
            adminConfig={adminConfig}
            onUpdateConfig={handleUpdateConfig}
            onAddLink={handleAddLink}
            onUpdateLink={handleUpdateLink}
            onDeleteLink={handleDeleteLink}
            onReorderLinks={handleReorderLinks}
          />
        </React.Suspense>
      )}

    </div>
  );
}

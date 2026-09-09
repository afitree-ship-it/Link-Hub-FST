import React, { useState, useEffect, useMemo } from "react";
import { Link, AdminConfig, User, AuthCredentials } from "./types";
import { DEFAULT_LINKS } from "./data/seed";
import { LinkCard } from "./components/LinkCard";
import { AdminPanel } from "./components/AdminPanel";
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
  Phone,
  Mail,
  LayoutGrid,
  List as ListIcon,
  AlignJustify,
  ChevronDown,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { sendActionToWebApp } from "./googleSheets";

export default function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"student" | "staff">("student");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list" | "compact">("grid");
  const [showViewMenu, setShowViewMenu] = useState(false);

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

  // Fetch Links & Configs
  const fetchData = async () => {
    setLoading(true);
    try {
      // Load config
      const savedConfig = localStorage.getItem("scitech_admin_config");
      let currentConfig: AdminConfig = {};
      if (savedConfig) {
        try {
          currentConfig = JSON.parse(savedConfig);
        } catch (e) {}
      }
      
      // Default configs if empty
      if (!currentConfig.googleSheetId) currentConfig.googleSheetId = "1pphCw3O30znOqQeyAgYsv9P4M6SRVGFVdn_aDbDqwPY";
      
      const BROKEN_SAMPLE_URL = "https://script.google.com/macros/s/AKfycbzdXp6CR3w67Ulw4ckaexumuYicKEsrnKYJZ7aoZVqcmdRug2ugJncRDmIZPetO-Pw5pg/exec";
      if (currentConfig.googleAppsScriptUrl === BROKEN_SAMPLE_URL) {
        currentConfig.googleAppsScriptUrl = "";
      }
      
      if (currentConfig.isGoogleSheetSyncEnabled === undefined) currentConfig.isGoogleSheetSyncEnabled = false;
      if (!currentConfig.syncInterval) currentConfig.syncInterval = 15;
      
      setAdminConfig(currentConfig);

      // Load Links
      const savedLinks = localStorage.getItem("scitech_links");
      let linkList: Link[] = [];
      if (savedLinks) {
        linkList = JSON.parse(savedLinks);
      }

      // Auto Seed if completely empty
      if (linkList.length === 0) {
        console.log("No links found. Seeding initial data...");
        linkList = DEFAULT_LINKS().map((l, i) => ({
          id: `seed-link-${i}`,
          ...l
        }));

        localStorage.setItem("scitech_links", JSON.stringify(linkList));
      }

      setLinks(linkList);
    } catch (error) {
      console.error("Error loading local storage data:", error);
    } finally {
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
  const handleIncrementClick = async (linkId: string) => {
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
  };

  // Admin Methods
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    
    const trimmedUser = loginUsername.trim();
    const enteredPass = loginPassword;

    try {
      // 1. Immediate validation against local admin database and default superadmin
      let localAdmins: (User & { password?: string })[] = [];
      try {
        const stored = localStorage.getItem("scitech_admin_users");
        if (stored) {
          localAdmins = JSON.parse(stored);
        }
      } catch (err) {}

      // Default superadmin if not present in list
      const defaultPassword = adminConfig.adminPassword || "admin1234";
      const hasAdmin = localAdmins.some(u => u.username.toLowerCase() === "admin");
      if (!hasAdmin) {
        localAdmins.unshift({
          username: "admin",
          password: defaultPassword,
          role: "superadmin",
          pinnedLinks: []
        });
      }

      // Check if credentials match any local admin
      const matchedLocalUser = localAdmins.find(
        u => u.username.toLowerCase() === trimmedUser.toLowerCase() && (u.password === enteredPass || (u.username.toLowerCase() === "admin" && enteredPass === defaultPassword))
      );

      if (matchedLocalUser) {
        const userObj: User = {
          username: matchedLocalUser.username,
          role: matchedLocalUser.role,
          pinnedLinks: matchedLocalUser.pinnedLinks || []
        };
        setIsAdmin(true);
        setCurrentUser(userObj);
        const credentials = { username: matchedLocalUser.username, password: enteredPass };
        setAuthCreds(credentials);
        
        sessionStorage.setItem("scitech_user", JSON.stringify(userObj));
        sessionStorage.setItem("scitech_auth_creds", JSON.stringify(credentials));
        
        setShowAdminModal(false);
        setLoginUsername("");
        setLoginPassword("");
        setLoginError("");
        setShowAdminPanel(true);
        setIsLoggingIn(false);
        return;
      }

      // 2. If not found locally, try verifying with Google Apps Script (with a 3.5s timeout)
      if (adminConfig.googleAppsScriptUrl) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

        try {
          const response = await fetch(adminConfig.googleAppsScriptUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain', 
            },
            body: JSON.stringify({
              action: 'login',
              username: trimmedUser,
              password: enteredPass,
            }),
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);

          const text = await response.text();
          let resData: any = null;
          try { resData = JSON.parse(text); } catch (e) {}

          if (resData && resData.success && resData.user) {
            setIsAdmin(true);
            setCurrentUser(resData.user);
            const credentials = { username: trimmedUser, password: enteredPass };
            setAuthCreds(credentials);
            
            sessionStorage.setItem("scitech_user", JSON.stringify(resData.user));
            sessionStorage.setItem("scitech_auth_creds", JSON.stringify(credentials));

            // Cache credentials locally for instant subsequent logins
            const updated = [
              ...localAdmins.filter(u => u.username.toLowerCase() !== trimmedUser.toLowerCase()),
              { ...resData.user, password: enteredPass }
            ];
            localStorage.setItem("scitech_admin_users", JSON.stringify(updated));
            
            setShowAdminModal(false);
            setLoginUsername("");
            setLoginPassword("");
            setLoginError("");
            setShowAdminPanel(true);
            setIsLoggingIn(false);
            return;
          }
        } catch (gasErr) {
          clearTimeout(timeoutId);
          console.warn("Google Apps Script login check error/timeout:", gasErr);
        }
      }

      setLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (หากเป็นครั้งแรกใช้ admin / admin1234)");
    } catch (err: any) {
      setLoginError(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStaffTabClick = () => {
    if (viewMode === "staff") return;

    // Optional: Only staff can enter if they know the password. If admin is logged in, they can.
    if (!adminConfig.staffPasswords || adminConfig.staffPasswords.length === 0 || isAdmin) {
      setViewMode("staff");
      return;
    }

    const isStaffUnlocked = sessionStorage.getItem("scitech_staff_session") === "true";
    if (isStaffUnlocked) {
      setViewMode("staff");
    } else {
      setShowStaffModal(true);
    }
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminConfig.staffPasswords && adminConfig.staffPasswords.includes(staffPasswordInput)) {
      sessionStorage.setItem("scitech_staff_session", "true");
      setShowStaffModal(false);
      setStaffPasswordInput("");
      setStaffLoginError("");
      setViewMode("staff");
    } else {
      setStaffLoginError("รหัสผ่านไม่ถูกต้อง");
    }
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
        const settingsToSave = {
          siteTitle: updated.siteTitle || "",
          siteLogoUrl: updated.siteLogoUrl || "",
        };
        await saveSettingsViaWebApp(updated.googleAppsScriptUrl, settingsToSave, authCreds);
      } catch (err) {
        console.error("Failed to sync settings to Google Sheets", err);
      }
    }
  };

  // Realtime Polling from Google Apps Script Web App
  useEffect(() => {
    if (adminConfig.googleAppsScriptUrl && adminConfig.isGoogleSheetSyncEnabled) {
      let isMounted = true;
      let failureCount = 0;

      const fetchFromSheet = async () => {
        if (!isMounted || !adminConfig.googleAppsScriptUrl) return;

        // Exponential backoff if the endpoint is failing/unreachable
        if (failureCount >= 3 && failureCount % 6 !== 0) {
          failureCount++;
          return;
        }

        try {
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

          const res = await fetch(adminConfig.googleAppsScriptUrl, {
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);

          if (res.ok) {
            failureCount = 0; // Reset on successful fetch
            const responseData = await res.json().catch(() => null);
            if (!responseData) return;

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
                const isSame = JSON.stringify(prev) === JSON.stringify(fetchedLinks);
                if (!isSame) {
                  localStorage.setItem("scitech_links", JSON.stringify(fetchedLinks));
                  return fetchedLinks;
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
        }
      };

      fetchFromSheet(); // Initial fetch
      
      const intervalMs = Math.max(adminConfig.syncInterval || 15, 10) * 1000;
      const interval = setInterval(fetchFromSheet, intervalMs);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [adminConfig.googleAppsScriptUrl, adminConfig.isGoogleSheetSyncEnabled, adminConfig.syncInterval]);

  // CRUD Links
  const handleAddLink = async (newLinkData: Omit<Link, "id" | "clickCount" | "createdAt">) => {
    const fullLink = {
      ...newLinkData,
      id: `link-${Date.now()}`,
      clickCount: 0,
      createdAt: new Date().toISOString(),
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
    let updatedLink: Link | null = null;
    setLinks(prev => {
      const updated = prev.map(l => {
        if (l.id === id) {
          updatedLink = { ...l, ...updates };
          return updatedLink;
        }
        return l;
      });
      localStorage.setItem("scitech_links", JSON.stringify(updated));
      return updated;
    });
    
    if (adminConfig.isGoogleSheetSyncEnabled && adminConfig.googleAppsScriptUrl) {
      import('./googleSheets').then(({ sendActionToWebApp }) => {
        // Since setLinks is async, updatedLink might not be captured yet if we don't await, 
        // but we set it synchronously inside the setter!
        if (updatedLink) {
          sendActionToWebApp(adminConfig.googleAppsScriptUrl!, 'update', { link: updatedLink });
        }
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
        sendActionToWebApp(adminConfig.googleAppsScriptUrl!, 'delete', { id });
      });
    }
  };

  // Filtering Logic
  const filteredLinks = useMemo(() => {
    const filtered = links.filter(link => {
      // 1. Audience Filter
      if (viewMode === "student" && link.isStaffOnly) {
        return false;
      }
      // 2. Search Filter
      const matchSearch = 
        link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.description && link.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        link.url.toLowerCase().includes(searchQuery.toLowerCase());
      
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
      // Then by creation date (newest first, or keep default order)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [links, searchQuery, viewMode]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans selection:bg-[#5c0620]/20 selection:text-[#5c0620] relative overflow-hidden">
      
      {/* Background Ambient Orbs (Mac Aesthetic) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#5c0620]/30 blur-[100px] mix-blend-multiply" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[70%] rounded-full bg-[#9f1239]/20 blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] left-[10%] w-[60%] h-[60%] rounded-full bg-[#4a044e]/20 blur-[120px] mix-blend-multiply" />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#fb7185]/15 blur-[90px] mix-blend-multiply" />
        
        {/* Subtle Grid overlay for technical feel */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      {/* 1. TOP HEADER BANNER - Mac Glassmorphism Theme */}
      {adminConfig.isAnnouncementActive && adminConfig.announcementText && (
        <div className="relative z-20 bg-rose-600 text-white px-4 py-2 text-center text-sm font-medium shadow-md">
          {adminConfig.announcementText}
        </div>
      )}
      <header className="relative z-10 pt-6 md:pt-10 pb-8 md:pb-12 px-4 md:px-8 border-b border-white/40 bg-white/40 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto relative z-10">
          
          {/* Top Row: Admin Indicator */}
          <div className="flex justify-end mb-6">
            {isAdmin ? (
              <div className="hidden sm:flex items-center gap-2 bg-white/60 border border-white/80 shadow-sm p-1 rounded-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="text-xs bg-white text-[#5c0620] font-bold px-3.5 py-1.5 rounded-xl hover:bg-rose-50 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5 text-[#5c0620]" />
                  <span>จัดการข้อมูล</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-[#5c0620] hover:bg-white transition-colors cursor-pointer"
                  title="ออกจากระบบแอดมิน"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white/50 hover:bg-white/80 px-4 py-2 rounded-2xl transition-all border border-white/60 shadow-sm cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>สำหรับผู้ดูแลระบบ (Admin)</span>
              </button>
            )}
          </div>

          {/* Main Title & Brand */}
          <div className="mb-8 md:mb-10 text-center flex flex-col items-center">
            
            {/* Animated Logo Display (Technology / Cyber HUD Style) */}
            {adminConfig.siteLogoUrl && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
                className="relative mb-8 md:mb-10 group flex items-center justify-center w-32 h-32 md:w-40 md:h-40"
              >
                {/* Tech HUD Ring 1 (Outer Dashed) */}
                <motion.div 
                  className="absolute inset-0 -m-3 rounded-full border-2 border-dashed border-[#5c0620]/30 opacity-70"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                />
                
                {/* Tech HUD Ring 2 (Middle Dotted) */}
                <motion.div 
                  className="absolute inset-0 m-0.5 rounded-full border-[3px] border-dotted border-rose-500/40"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
                />

                {/* Tech HUD Ring 3 (Inner Tech glow) */}
                <motion.div 
                  className="absolute inset-2 rounded-full border border-[#5c0620]/20 shadow-[0_0_25px_rgba(92,6,32,0.15)] bg-white/60 backdrop-blur-md"
                  animate={{ scale: [1, 1.03, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                />

                {/* Scanner line overlay */}
                <motion.div
                  className="absolute inset-0 overflow-hidden rounded-full z-20 pointer-events-none opacity-40 mix-blend-overlay"
                >
                   <motion.div 
                     className="w-full h-1.5 bg-gradient-to-r from-transparent via-[#5c0620] to-transparent shadow-[0_0_8px_#5c0620]"
                     animate={{ y: [-150, 150] }}
                     transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                   />
                </motion.div>

                {/* Logo Image */}
                <motion.img 
                  src={adminConfig.siteLogoUrl} 
                  alt="Site Logo" 
                  className="w-24 h-24 md:w-32 md:h-32 object-contain relative z-10 drop-shadow-[0_0_12px_rgba(92,6,32,0.4)] p-1.5"
                  whileHover={{ scale: 1.08, rotate: 2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                />
              </motion.div>
            )}

            <div className="space-y-3 md:space-y-4 flex flex-col items-center">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="px-3.5 py-1 text-[10px] md:text-[11px] font-extrabold tracking-wider uppercase text-[#5c0620] bg-white/80 backdrop-blur-sm rounded-full border border-[#5c0620]/20 shadow-sm">
                  FACULTY OF SCIENCE AND TECHNOLOGY
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#3a0210] via-[#5c0620] to-[#881337] leading-tight pb-1">
                ระบบพอร์ทัลลิงก์สำคัญ
              </h1>
              <p className="text-sm md:text-base text-slate-600 max-w-2xl font-light leading-relaxed">
                ศูนย์รวมลิงก์บริการและระบบงานสำคัญของคณะวิทยาศาสตร์และเทคโนโลยี ไว้ในหน้าเดียว
              </p>
            </div>
          </div>

          {/* Floating Search Bar */}
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-slate-400 group-focus-within:text-[#5c0620] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาระบบ, ลิงก์ หรือบริการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-4 bg-white/80 backdrop-blur-md text-slate-800 placeholder-slate-400 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] focus:outline-hidden focus:ring-4 focus:ring-[#5c0620]/20 focus:border-[#5c0620]/40 focus:bg-white text-sm transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 2. MAIN APP CONTAINER - Streamlined Full Width Layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 flex-1 w-full space-y-6 md:space-y-8 relative z-10">
        
        {/* LINKS GRID HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 md:pb-4 border-b border-slate-200/50">
          <div className="flex flex-col gap-2">
            <h3 className="font-extrabold text-slate-800 text-lg md:text-xl tracking-tight">
              ลิงก์ระบบงานและบริการสำคัญของคณะฯ
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#5c0620] bg-white/60 backdrop-blur-md border border-white px-3 py-1 rounded-full shadow-sm">
                ทั้งหมด {filteredLinks.length} รายการ
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-white/70 backdrop-blur-md p-1 rounded-full shadow-sm border border-white/80 flex-1 sm:flex-none">
              <button
                onClick={() => setViewMode("student")}
                className={`flex-1 sm:flex-none px-3 py-2 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  viewMode === "student" 
                    ? "bg-[#5c0620] text-white shadow-md shadow-[#5c0620]/20" 
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <GraduationCap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${viewMode === "student" ? "text-white" : "text-slate-400"}`} />
                สำหรับนักศึกษา
              </button>
              <button
                onClick={handleStaffTabClick}
                className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 group ${
                  viewMode === "staff" 
                    ? "bg-slate-800 text-white shadow-md" 
                    : "text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                }`}
                title="สำหรับเจ้าหน้าที่/บุคลากร"
              >
                <ShieldAlert className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-colors ${viewMode === "staff" ? "text-rose-300" : "text-slate-400 group-hover:text-rose-500"}`} />
                <span>สำหรับบุคลากร</span>
              </button>
            </div>

            {/* View Layout Selector */}
            <div className="relative self-end sm:self-auto">
              <button
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="flex items-center gap-1.5 bg-white/80 hover:bg-white text-slate-700 px-3 py-2 rounded-xl border border-slate-200/60 shadow-sm text-sm font-medium transition-all cursor-pointer"
                title="มุมมอง"
              >
                {layoutMode === "grid" && <LayoutGrid className="w-4 h-4" />}
                {layoutMode === "list" && <ListIcon className="w-4 h-4" />}
                {layoutMode === "compact" && <AlignJustify className="w-4 h-4" />}
                <span className="hidden sm:inline">มุมมอง</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              
              {showViewMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowViewMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-[200px] bg-white/95 backdrop-blur-xl rounded-xl border border-slate-100 shadow-xl z-40 p-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={() => { setLayoutMode("grid"); setShowViewMenu(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${layoutMode === "grid" ? "bg-slate-50 text-[#5c0620]" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <LayoutGrid className="w-4 h-4 text-slate-400" />
                      <span>ไอคอนขนาดใหญ่ (Grid)</span>
                      {layoutMode === "grid" && <Check className="w-3.5 h-3.5 ml-auto text-[#5c0620]" />}
                    </button>
                    <button
                      onClick={() => { setLayoutMode("list"); setShowViewMenu(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${layoutMode === "list" ? "bg-slate-50 text-[#5c0620]" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <ListIcon className="w-4 h-4 text-slate-400" />
                      <span>รายการละเอียด (List)</span>
                      {layoutMode === "list" && <Check className="w-3.5 h-3.5 ml-auto text-[#5c0620]" />}
                    </button>
                    <button
                      onClick={() => { setLayoutMode("compact"); setShowViewMenu(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${layoutMode === "compact" ? "bg-slate-50 text-[#5c0620]" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <AlignJustify className="w-4 h-4 text-slate-400" />
                      <span>กะทัดรัด (Compact)</span>
                      {layoutMode === "compact" && <Check className="w-3.5 h-3.5 ml-auto text-[#5c0620]" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Helper info */}
        {searchQuery && (
          <div className="text-xs text-slate-500 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/60 shadow-sm self-start inline-block">
            ผลลัพธ์การค้นหาคำว่า <strong className="text-[#5c0620] font-bold">"{searchQuery}"</strong>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="py-24 text-center space-y-4 bg-white/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Loader2 className="w-10 h-10 animate-spin text-[#5c0620] mx-auto" />
            <p className="text-sm text-slate-500 font-medium font-sans">กำลังโหลดข้อมูลพอร์ทัลลิงก์...</p>
          </div>
        ) : (
          <>
            {/* LINKS CONTAINER */}
            {filteredLinks.length === 0 ? (
              <div className="py-20 text-center bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
                <Globe className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-700 text-lg">ไม่พบลิงก์ในระบบที่ตรงกับการค้นหา</h4>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    กรุณาลองเปลี่ยนคำค้นหาเพื่อตรวจดูใหม่อีกครั้ง
                  </p>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs bg-white text-[#5c0620] hover:text-[#3a0210] hover:bg-slate-50 font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm border border-slate-100"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}
              </div>
            ) : (
              <div className={
                layoutMode === "grid" ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6" :
                layoutMode === "list" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5" :
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3"
              }>
                <AnimatePresence>
                  {filteredLinks.map((link, index) => {
                    return (
                      <motion.div 
                        key={link.id}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, margin: "50px" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <LinkCard
                          link={link}
                          isAdmin={isAdmin}
                          layoutMode={layoutMode}
                          isPersonalPin={isAdmin && (currentUser?.pinnedLinks || []).includes(link.id)}
                          onIncrementClick={handleIncrementClick}
                          onEdit={(l) => {
                            setShowAdminPanel(true);
                          }}
                          onDelete={(id) => {
                            handleDeleteLink(id);
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

      </main>

      {/* 3. APP FOOTER */}
      <footer className="bg-white/40 backdrop-blur-2xl text-slate-600 mt-10 md:mt-20 border-t border-white/60 shadow-[0_-4px_30px_rgba(0,0,0,0.02)] relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Col 1: About Faculty */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5 text-slate-800">
              <GraduationCap className="w-6 h-6 text-[#5c0620]" />
              <span className="font-extrabold text-base tracking-tight">คณะวิทยาศาสตร์และเทคโนโลยี</span>
            </div>
            <p className="text-xs leading-relaxed font-medium text-slate-500">
              มุ่งเน้นการสร้างสรรค์องค์ความรู้ งานวิจัย และพัฒนากำลังคนด้านวิทยาศาสตร์ ไอที และเทคโนโลยี เพื่อการพัฒนาสังคมและเศรษฐกิจที่ยั่งยืน
            </p>
          </div>

          {/* Col 2: Contact Info */}
          <div className="space-y-3.5">
            <h4 className="text-slate-800 font-bold text-sm tracking-tight">ช่องทางการติดต่อคณะ</h4>
            <ul className="text-xs space-y-3 font-medium text-slate-500">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#5c0620] shrink-0" />
                <span>อาคารคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยฟัตตอนี</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#5c0620] shrink-0" />
                <span>073-418600 (ต่อ งานบริการหลักสูตร)</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#5c0620] shrink-0" />
                <span>scitech@ftu.ac.th</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Disclaimer & System info */}
          <div className="space-y-3.5">
            <h4 className="text-slate-800 font-bold text-sm tracking-tight">ผู้ดูแลระบบและจัดการข้อมูล</h4>
            <p className="text-xs leading-relaxed font-medium text-slate-500 mb-4">
              เข้าสู่ระบบหลังบ้านเพื่อจัดการพอร์ทัลลิงก์ สำหรับเจ้าหน้าที่และบุคลากร
            </p>
            {isAdmin ? (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="text-xs bg-[#5c0620] hover:bg-[#881337] text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>เปิดแผงควบคุมระบบ (Admin Control)</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                className="text-xs bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm text-slate-600 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                เข้าสู่หลังบ้านแอดมิน
              </button>
            )}
          </div>
        </div>

        {/* Bottom Credits Line */}
        <div className="border-t border-white/60 bg-white/20 py-4">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between text-[10px] sm:text-xs text-slate-500 font-medium">
            <p>&copy; {new Date().getFullYear()} Faculty of Science and Technology. All Rights Reserved.</p>
            <p className="mt-1 md:mt-0">Designed & Developed by FST IT Team</p>
          </div>
        </div>
      </footer>

      {/* 4. MODAL: ADMIN LOGIN */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] max-w-md w-full p-6 border border-white relative space-y-5">
            <button 
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-white text-[#5c0620] rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-white">
                <Lock className="w-6 h-6 text-[#5c0620]" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">เข้าสู่ระบบ (Admin Login)</h3>
              <p className="text-xs text-slate-500">กรุณาเข้าสู่ระบบเพื่อจัดการพอร์ทัลลิงก์</p>
            </div>

            {/* Info notice about default password */}
            <div className="p-3 bg-white/60 rounded-xl border border-white shadow-sm text-[11px] text-slate-600 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#5c0620]" />
              <div>
                <strong>สำหรับเริ่มต้นใช้งาน:</strong> ผู้ดูแลระบบหลัก (Super Admin) ใช้ชื่อผู้ใช้ <code className="font-mono bg-white px-1 py-0.5 rounded-xs border border-slate-100 font-bold text-slate-800 shadow-sm">admin</code> และรหัสผ่าน <code className="font-mono bg-white px-1 py-0.5 rounded-xs border border-slate-100 font-bold text-slate-800 shadow-sm">admin1234</code>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">ชื่อผู้ใช้งาน (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="ป้อน Username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white shadow-inner bg-white/50 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#5c0620]/20 focus:border-[#5c0620]/40 text-sm transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">รหัสผ่าน (Password)</label>
                <input
                  type="password"
                  required
                  placeholder="ป้อนรหัสผ่าน"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white shadow-inner bg-white/50 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#5c0620]/20 focus:border-[#5c0620]/40 text-sm font-mono transition-all"
                />
              </div>

              {loginError && (
                <p className="text-xs text-[#881337] font-semibold text-center flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{loginError}</span>
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-white shadow-sm text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 py-2.5 bg-[#5c0620] hover:bg-[#881337] text-white shadow-sm text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังเข้าสู่ระบบ</span>
                    </>
                  ) : (
                    <>
                      เข้าสู่ระบบ
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-xl border border-white">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-rose-50 flex items-center justify-center rounded-2xl mb-4">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center">เข้าใช้งานหมวดหมู่บุคลากร</h3>
              <p className="text-xs text-slate-500 text-center mt-2 px-4">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานลิงก์สำหรับบุคลากร</p>
            </div>
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="รหัสผ่าน"
                  autoFocus
                  value={staffPasswordInput}
                  onChange={(e) => setStaffPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm bg-slate-50 focus:bg-white transition-all text-center tracking-widest font-mono"
                />
              </div>
              {staffLoginError && (
                <p className="text-rose-500 text-xs font-semibold text-center">{staffLoginError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white shadow-sm text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADMIN CONTROL PANEL (CRUD WORKSPACE) */}
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
      />

    </div>
  );
}

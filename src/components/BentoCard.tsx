import React, { useState } from "react";
import { Link } from "../types";
import { ArrowUpRight, Pin, PinOff, Edit2, Trash2, BarChart2, Wrench } from "lucide-react";
import { Language } from "../i18n";

export type BentoVariant = "feature" | "wide" | "small";

interface BentoCardProps {
  link: Link;
  variant: BentoVariant;
  index: number;
  rank?: number;
  isMyPin: boolean;
  isAdmin: boolean;
  lang?: Language;
  onTogglePin: (id: string) => void;
  onIncrementClick: (id: string) => void;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
}

// Soft tile colours used when a link has no picture of its own.
const TILE_COLORS = [
  { bg: "#fbe7ec", fg: "#5c0620" },
  { bg: "#e8eefc", fg: "#1d3f9a" },
  { bg: "#e3f1ec", fg: "#1d5c45" },
  { bg: "#fdf0dc", fg: "#7a4a06" },
  { bg: "#ece8f7", fg: "#43307f" },
];

export const getHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Site icon: the link's own picture is shown elsewhere; this is the small square badge. */
export const SiteIcon: React.FC<{ link: Link; index: number; size: number; radius: number }> = ({ link, index, size, radius }) => {
  const [failed, setFailed] = useState(false);
  const host = getHost(link?.url || "");
  const colorIndex = Math.abs(typeof index === "number" ? index : 0) % TILE_COLORS.length;
  const color = TILE_COLORS[colorIndex] || TILE_COLORS[0];
  const safeTitle = typeof link?.title === "string" ? link.title : String(link?.title || "");
  return (
    <span
      className="flex items-center justify-center shrink-0 overflow-hidden font-bold"
      style={{ width: size, height: size, borderRadius: radius, background: color.bg, color: color.fg, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {host && !failed ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=128`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: size * 0.55, height: size * 0.55 }}
        />
      ) : (
        (safeTitle.match(/[A-Za-z0-9ก-ฮ]/) || ["?"])[0].toUpperCase()
      )}
    </span>
  );
};

export const BentoCard: React.FC<BentoCardProps> = React.memo(({
  link, variant, index, rank, isMyPin, isAdmin, lang = "th", onTogglePin, onIncrementClick, onEdit, onDelete,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!link.thumbnailUrl && !imgFailed;
  const dark = variant === "wide";

  const renderMaintenanceBadge = () => {
    if (!link.isMaintenance) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 shadow-2xs">
        <Wrench className="w-3 h-3 text-amber-700 dark:text-amber-400" />
        {lang === 'en' ? 'Under Maintenance' : 'ปิดปรับปรุงระบบ'}
      </span>
    );
  };

  const renderClickStat = (isDark = false) => (
    <span 
      title={lang === 'en' ? "Real-time usage stats" : "สถิติการเข้าใช้งานแบบเรียลไทม์"}
      className={`inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
        isDark ? 'bg-white/15 text-white' : 'bg-[#f3f0ef] text-[#4a4245] dark:bg-white/10 dark:text-slate-200'
      }`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <BarChart2 className="w-3 h-3 text-[#5c0620] dark:text-rose-400" />
      <span>{lang === 'en' ? `${(link.clickCount || 0).toLocaleString()} views` : `เข้าชม ${(link.clickCount || 0).toLocaleString()} ครั้ง`}</span>
    </span>
  );

  const pinButton = (
    <button
      type="button"
      onClick={() => onTogglePin(link.id)}
      aria-pressed={isMyPin}
      aria-label={isMyPin ? (lang === 'en' ? `Remove ${link.title} from pins` : `เอา ${link.title} ออกจากหมุดของฉัน`) : (lang === 'en' ? `Pin ${link.title}` : `ปักหมุด ${link.title}`)}
      title={isMyPin ? (lang === 'en' ? "Remove from my pins" : "เอาออกจากหมุดของฉัน") : (lang === 'en' ? "Pin to my pins" : "ปักหมุดไว้ที่ของฉัน")}
      className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
        isMyPin
          ? "bg-[#5c0620] text-white"
          : dark
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-white/90 dark:bg-[#2a252a] text-[#4a4245] dark:text-slate-200 hover:bg-white dark:hover:bg-[#342e34] hover:text-[#5c0620] dark:hover:text-rose-400 shadow-sm border border-transparent dark:border-white/10"
      }`}
    >
      {isMyPin ? <PinOff className="w-[18px] h-[18px]" /> : <Pin className="w-[18px] h-[18px]" />}
    </button>
  );

  const adminButtons = (dark: boolean) => isAdmin && (
    <div className="relative z-10 flex gap-2">
      <button type="button" onClick={onEdit} className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-[13px] font-semibold cursor-pointer ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50"}`}>
        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />{lang === 'en' ? 'Edit' : 'แก้ไข'}
      </button>
      <button type="button" onClick={() => onDelete && onDelete(link.id)} className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-[13px] font-semibold cursor-pointer ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/50"}`}>
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />{lang === 'en' ? 'Delete' : 'ลบ'}
      </button>
    </div>
  );

  const handleLinkClick = (e: React.MouseEvent) => {
    if (link.isMaintenance) {
      e.preventDefault();
      e.stopPropagation();
      const note = link.maintenanceNote?.trim();
      const msg = note
        ? (lang === 'en'
            ? `⚠️ System Under Maintenance:\n\n"${note}"\n\nPlease try again later.`
            : `⚠️ ระบบกำลังปิดปรับปรุงชั่วคราว:\n\n"${note}"\n\nขออภัยในความไม่สะดวก กรุณาลองใหม่อีกครั้งในภายหลัง`)
        : (lang === 'en'
            ? "⚠️ This system is currently under maintenance. Please try again later."
            : "⚠️ ระบบนี้กำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก กรุณาลองใหม่อีกครั้งในภายหลัง");
      alert(msg);
      return;
    }
    onIncrementClick(link.id);
  };

  const mainLink = (className: string, children: React.ReactNode) => (
    <a
      href={link.isMaintenance ? "#" : link.url}
      target={link.isMaintenance ? undefined : "_blank"}
      rel={link.isMaintenance ? undefined : "noopener noreferrer"}
      onClick={handleLinkClick}
      className={`${className} after:absolute after:inset-0 after:content-[''] focus-visible:outline-none ${link.isMaintenance ? 'cursor-not-allowed' : ''}`}
    >
      {children}
    </a>
  );

  const cardBase = `group relative rounded-[22px] sm:rounded-[26px] overflow-hidden transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 focus-within:ring-4 focus-within:ring-[#5c0620]/30 dark:focus-within:ring-rose-500/30 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_22px_rgba(0,0,0,0.11)] border ${link.isMaintenance ? 'border-amber-300 dark:border-amber-700/60' : 'border-slate-200/90 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'} transform-gpu link-card-contain`;

  if (variant === "feature") {
    return (
      <div className={`${cardBase} bg-white dark:bg-[#1e1b1e] flex flex-col h-full`}>
        {hasImage ? (
          <div className="relative h-28 sm:h-40 bg-[#e4dfdd] dark:bg-[#2c272c] overflow-hidden">
            <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="w-full h-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.015] transform-gpu" />
          </div>
        ) : null}
        <div className="absolute top-3 right-3">{pinButton}</div>
        <div className="flex-1 flex flex-col justify-between gap-3 p-4 sm:p-5">
          {!hasImage && <SiteIcon link={link} index={index} size={48} radius={16} />}
          {mainLink("block",
            <>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {renderMaintenanceBadge()}
                {rank ? (
                  <span className="whitespace-nowrap text-[12px] font-semibold bg-[#f3f0ef] dark:bg-white/10 text-[#4a4245] dark:text-slate-300 rounded-full px-2.5 py-0.5">{lang === 'en' ? `Top #${rank}` : `ยอดนิยม #${rank}`}</span>
                ) : null}
              </div>
              <span className="block text-[16px] sm:text-[19px] font-bold leading-snug text-[#1f1a1c] dark:text-white">{link.title}</span>
              {link.description && <span className="mt-1 text-[13px] sm:text-[14px] text-[#5e5558] dark:text-slate-300 leading-relaxed line-clamp-2">{link.description}</span>}
            </>
          )}
          <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-[#f3f0ef] dark:border-white/10">
            {renderClickStat(false)}
            {adminButtons(false)}
          </div>
        </div>
      </div>
    );
  }

  const tileIndex = Math.abs(typeof index === "number" ? index : 0) % TILE_COLORS.length;
  const tile = TILE_COLORS[tileIndex] || TILE_COLORS[0];

  if (variant === "wide") {
    return (
      <div className={`${cardBase} bg-white dark:bg-[#1e1b1e] col-span-2 ring-2 ring-[#5c0620] dark:ring-rose-600 grid grid-cols-1 sm:grid-cols-2`}>
        <div className="relative aspect-[16/10] sm:aspect-auto sm:min-h-[220px] overflow-hidden flex items-center justify-center" style={hasImage ? undefined : { background: tile.bg }}>
          {hasImage ? (
            <div className="absolute inset-0 bg-[#e4dfdd] dark:bg-[#2c272c]">
              <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="w-full h-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.015] transform-gpu" />
            </div>
          ) : (
            <SiteIcon link={link} index={index} size={72} radius={22} />
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-6 justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap pr-12">
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold bg-[#5c0620] dark:bg-rose-700 text-white rounded-full px-2.5 py-0.5">
                <Pin className="w-3 h-3" aria-hidden="true" />{lang === 'en' ? 'Pinned by Faculty' : 'ปักหมุดโดยคณะ'}
              </span>
              {renderMaintenanceBadge()}
            </div>
            {mainLink("block flex-1 min-w-0 pr-12",
              <>
                <span className="block text-[18px] sm:text-[22px] font-bold leading-snug text-[#1f1a1c] dark:text-white">{link.title}</span>
                {link.description && <span className="mt-1.5 text-[13px] sm:text-[15px] text-[#5e5558] dark:text-slate-300 leading-relaxed line-clamp-3">{link.description}</span>}
                {link.isMaintenance ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-amber-700 dark:text-amber-400">
                    <Wrench className="w-4 h-4" /> {lang === 'en' ? 'Under Maintenance' : 'ปิดปรับปรุงชั่วคราว'}
                  </span>
                ) : (
                  <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-[#5c0620] dark:text-rose-400">
                    {lang === 'en' ? 'Open Website' : 'เปิดเว็บไซต์'} <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f3f0ef] dark:border-white/10">
            {renderClickStat(false)}
            {adminButtons(false)}
          </div>
        </div>
        <div className="absolute top-2 right-2">{pinButton}</div>
      </div>
    );
  }

  return (
    <div className={`${cardBase} bg-white dark:bg-[#1e1b1e] flex flex-col h-full`}>
      <div className="relative aspect-[16/10] overflow-hidden flex items-center justify-center" style={hasImage ? undefined : { background: tile.bg }}>
        {hasImage ? (
          <div className="absolute inset-0 bg-[#e4dfdd] dark:bg-[#2c272c]">
            <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="w-full h-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.015] transform-gpu" />
          </div>
        ) : (
          <SiteIcon link={link} index={index} size={56} radius={18} />
        )}
      </div>
      <div className="flex-1 flex flex-col gap-2 p-3.5 sm:p-4 justify-between">
        <div>
          {link.isMaintenance && (
            <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
              {renderMaintenanceBadge()}
            </div>
          )}
          {mainLink("block flex-1 min-w-0",
            <>
              <span className="text-[14px] sm:text-[16px] font-semibold leading-snug text-[#1f1a1c] dark:text-white line-clamp-2">{link.title}</span>
              {link.description && <span className="hidden sm:line-clamp-2 mt-1 text-[13px] text-[#5e5558] dark:text-slate-300">{link.description}</span>}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 mt-auto pt-2 border-t border-[#f3f0ef] dark:border-white/10">
          {renderClickStat(false)}
          {adminButtons(false)}
        </div>
      </div>
      <div className="absolute top-2 right-2">{pinButton}</div>
    </div>
  );
});

import React, { useState } from "react";
import { Link } from "../types";
import { ArrowUpRight, Pin, PinOff, Edit2, Trash2 } from "lucide-react";

export type BentoVariant = "feature" | "wide" | "small";

interface BentoCardProps {
  link: Link;
  variant: BentoVariant;
  index: number;
  rank?: number;
  isMyPin: boolean;
  isAdmin: boolean;
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
  const host = getHost(link.url);
  const color = TILE_COLORS[index % TILE_COLORS.length];
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
        ((link.title || "").match(/[A-Za-z0-9ก-ฮ]/) || ["?"])[0].toUpperCase()
      )}
    </span>
  );
};

export const BentoCard: React.FC<BentoCardProps> = React.memo(({
  link, variant, index, rank, isMyPin, isAdmin, onTogglePin, onIncrementClick, onEdit, onDelete,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!link.thumbnailUrl && !imgFailed;
  const dark = variant === "wide";

  const pinButton = (
    <button
      type="button"
      onClick={() => onTogglePin(link.id)}
      aria-pressed={isMyPin}
      aria-label={isMyPin ? `เอา ${link.title} ออกจากหมุดของฉัน` : `ปักหมุด ${link.title}`}
      title={isMyPin ? "เอาออกจากหมุดของฉัน" : "ปักหมุดไว้ที่ของฉัน"}
      className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
        isMyPin
          ? "bg-[#5c0620] text-white"
          : dark
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-white/90 text-[#4a4245] hover:bg-white hover:text-[#5c0620] shadow-sm"
      }`}
    >
      {isMyPin ? <PinOff className="w-[18px] h-[18px]" /> : <Pin className="w-[18px] h-[18px]" />}
    </button>
  );

  const adminButtons = isAdmin && (
    <div className="relative z-10 flex gap-1">
      <button type="button" onClick={onEdit} aria-label="แก้ไข" title="แก้ไข" className="w-9 h-9 rounded-full bg-white/90 text-amber-600 hover:bg-amber-50 flex items-center justify-center cursor-pointer shadow-sm">
        <Edit2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => onDelete && onDelete(link.id)} aria-label="ลบ" title="ลบ" className="w-9 h-9 rounded-full bg-white/90 text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer shadow-sm">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  // The whole card is clickable through a stretched link; pin/admin buttons sit above it.
  const mainLink = (className: string, children: React.ReactNode) => (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onIncrementClick(link.id)}
      className={`${className} after:absolute after:inset-0 after:content-[''] focus-visible:outline-none`}
    >
      {children}
    </a>
  );

  const cardBase = "group relative rounded-[22px] sm:rounded-[26px] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 focus-within:ring-4 focus-within:ring-[#5c0620]/30";

  if (variant === "feature") {
    return (
      <div className={`${cardBase} bg-white flex flex-col h-full`}>
        {hasImage ? (
          <div className="relative h-28 sm:h-40 bg-[#e4dfdd] overflow-hidden">
            <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
        ) : null}
        <div className={`absolute top-3 right-3 flex items-center gap-2`}>
          {adminButtons}
          {pinButton}
        </div>
        <div className="flex-1 flex flex-col justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            {!hasImage && <SiteIcon link={link} index={index} size={48} radius={16} />}
            {rank ? (
              <span className={`whitespace-nowrap text-[12px] font-semibold bg-[#f3f0ef] text-[#4a4245] rounded-full px-2.5 py-1 ${hasImage ? "" : "mr-12"}`}><span className="hidden sm:inline">ยอดนิยม </span>#{rank}</span>
            ) : null}
          </div>
          {mainLink("block",
            <>
              <span className="block text-[16px] sm:text-[19px] font-bold leading-snug text-[#1f1a1c]">{link.title}</span>
              {link.description && <span className="mt-1 text-[13px] sm:text-[14px] text-[#5e5558] leading-relaxed line-clamp-2">{link.description}</span>}
            </>
          )}
        </div>
      </div>
    );
  }

  if (variant === "wide") {
    return (
      <div className={`${cardBase} bg-[#1f1a1c] text-white col-span-2 min-h-[96px] sm:min-h-[140px] flex items-center gap-4 sm:gap-5 p-4 sm:p-6`}>
        {hasImage && (
          <>
            <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover opacity-35 transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-r from-[#1f1a1c] via-[#1f1a1c]/80 to-[#1f1a1c]/30" aria-hidden="true" />
          </>
        )}
        <span className="relative"><SiteIcon link={link} index={index} size={56} radius={18} /></span>
        {mainLink("relative flex-1 min-w-0",
          <>
            <span className="block text-[17px] sm:text-[22px] font-bold leading-snug">{link.title}</span>
            {link.description && <span className="mt-1 text-[13px] sm:text-[15px] text-[#d6cfd1] line-clamp-2 sm:line-clamp-1">{link.description}</span>}
          </>
        )}
        <div className="relative flex items-center gap-2">
          {adminButtons}
          {pinButton}
          <ArrowUpRight className="hidden sm:block w-7 h-7" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardBase} bg-white flex flex-col h-full`}>
      {hasImage && (
        <div className="relative h-24 sm:h-28 bg-[#e4dfdd] overflow-hidden">
          <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      )}
      <div className="flex-1 flex flex-col gap-2.5 sm:gap-3 p-3.5 sm:p-4">
        {!hasImage && <SiteIcon link={link} index={index} size={44} radius={14} />}
        {mainLink("block flex-1 min-w-0",
          <>
            <span className="block text-[14px] sm:text-[16px] font-semibold leading-snug text-[#1f1a1c]">{link.title}</span>
            {link.description && <span className="hidden sm:line-clamp-2 mt-1 text-[13px] text-[#5e5558]">{link.description}</span>}
          </>
        )}
      </div>
      <div className={`absolute ${hasImage ? "top-2 right-2" : "top-2.5 right-2.5"} flex items-center gap-1.5`}>
        {adminButtons}
        {pinButton}
      </div>
    </div>
  );
});

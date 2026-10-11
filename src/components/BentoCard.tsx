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

  // Admin tools sit in their own row so they never cover the title, badge or pin.
  const adminButtons = (dark: boolean) => isAdmin && (
    <div className="relative z-10 flex gap-2">
      <button type="button" onClick={onEdit} className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-[13px] font-semibold cursor-pointer ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>
        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />แก้ไข
      </button>
      <button type="button" onClick={() => onDelete && onDelete(link.id)} className={`flex items-center gap-1.5 px-3 min-h-9 rounded-full text-[13px] font-semibold cursor-pointer ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-rose-50 text-rose-800 hover:bg-rose-100"}`}>
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />ลบ
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
        <div className="absolute top-3 right-3">{pinButton}</div>
        <div className="flex-1 flex flex-col justify-between gap-3 p-4 sm:p-5">
          {!hasImage && <SiteIcon link={link} index={index} size={48} radius={16} />}
          {mainLink("block",
            <>
              {rank ? (
                <span className="inline-block mb-1.5 whitespace-nowrap text-[12px] font-semibold bg-[#f3f0ef] text-[#4a4245] rounded-full px-2.5 py-0.5">ยอดนิยม #{rank}</span>
              ) : null}
              <span className="block text-[16px] sm:text-[19px] font-bold leading-snug text-[#1f1a1c]">{link.title}</span>
              {link.description && <span className="mt-1 text-[13px] sm:text-[14px] text-[#5e5558] leading-relaxed line-clamp-2">{link.description}</span>}
            </>
          )}
          {adminButtons(false)}
        </div>
      </div>
    );
  }

  const tile = TILE_COLORS[index % TILE_COLORS.length];

  // Admin-pinned link: twice as wide, the site picture shown in full, outlined in the faculty colour.
  if (variant === "wide") {
    return (
      <div className={`${cardBase} bg-white col-span-2 ring-2 ring-[#5c0620] grid grid-cols-1 sm:grid-cols-2`}>
        <div className="relative aspect-[16/10] sm:aspect-auto sm:min-h-[220px] overflow-hidden flex items-center justify-center" style={hasImage ? { background: "#e4dfdd" } : { background: tile.bg }}>
          {hasImage ? (
            <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <SiteIcon link={link} index={index} size={72} radius={22} />
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {mainLink("block flex-1 min-w-0 pr-12",
            <>
              <span className="inline-flex items-center gap-1 mb-2 text-[12px] font-semibold bg-[#5c0620] text-white rounded-full px-2.5 py-0.5">
                <Pin className="w-3 h-3" aria-hidden="true" />ปักหมุดโดยคณะ
              </span>
              <span className="block text-[18px] sm:text-[22px] font-bold leading-snug text-[#1f1a1c]">{link.title}</span>
              {link.description && <span className="mt-1.5 text-[13px] sm:text-[15px] text-[#5e5558] leading-relaxed line-clamp-3">{link.description}</span>}
              <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-[#5c0620]">เปิดเว็บไซต์ <ArrowUpRight className="w-4 h-4" aria-hidden="true" /></span>
            </>
          )}
          {adminButtons(false)}
        </div>
        <div className="absolute top-2 right-2">{pinButton}</div>
      </div>
    );
  }

  // Standard card: every link looks the same. Picture area is always there (the site's
  // picture, or its icon on a soft tile) so cards line up row by row.
  return (
    <div className={`${cardBase} bg-white flex flex-col h-full`}>
      <div className="relative aspect-[16/10] overflow-hidden flex items-center justify-center" style={hasImage ? { background: "#e4dfdd" } : { background: tile.bg }}>
        {hasImage ? (
          <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <SiteIcon link={link} index={index} size={56} radius={18} />
        )}
      </div>
      <div className="flex-1 flex flex-col gap-2 p-3.5 sm:p-4">
        {mainLink("block flex-1 min-w-0",
          <>
            <span className="text-[14px] sm:text-[16px] font-semibold leading-snug text-[#1f1a1c] line-clamp-2">{link.title}</span>
            {link.description && <span className="hidden sm:line-clamp-2 mt-1 text-[13px] text-[#5e5558]">{link.description}</span>}
          </>
        )}
        {adminButtons(false)}
      </div>
      <div className="absolute top-2 right-2">{pinButton}</div>
    </div>
  );
});

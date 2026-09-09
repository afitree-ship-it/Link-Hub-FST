import React, { useState } from "react";
import { Link } from "../types";
import { ExternalLink, Copy, Check, Trash2, Edit2, BarChart2, Pin } from "lucide-react";
import { DynamicIcon } from "./DynamicIcon";
import { motion } from "motion/react";

interface LinkCardProps {
  link: Link;
  isAdmin: boolean;
  layoutMode?: "grid" | "list" | "compact";
  onIncrementClick: (id: string) => void;
  onEdit?: (link: Link) => void;
  onDelete?: (id: string) => void;
  isPersonalPin?: boolean;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
  isAdmin,
  layoutMode = "grid",
  onIncrementClick,
  onEdit,
  onDelete,
  isPersonalPin = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClick = (e: React.MouseEvent) => {
    onIncrementClick(link.id);
  };

  // Default fallback images based on link category or general
  const getFallbackImage = () => {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop"; // General tech
  };

  return (
    <motion.a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -2, scale: layoutMode === "grid" ? 1.01 : 1.002 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onClick={handleClick}
      className={`group relative flex bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/80 hover:border-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(92,6,32,0.12)] transition-all duration-300 cursor-pointer overflow-hidden ${
        layoutMode === "grid" ? "flex-col h-full" : 
        layoutMode === "list" ? "flex-col sm:flex-row h-auto sm:h-32" : 
        "flex-row items-center py-2 px-3 sm:px-4 h-auto"
      }`}
    >
          {/* Link Thumbnail Image */}
      {layoutMode !== "compact" && (
        <div className={`relative bg-slate-100/50 overflow-hidden shrink-0 ${
          layoutMode === "grid" ? "w-full h-28 sm:h-44" : "w-full sm:w-48 h-28 sm:h-full"
        }`}>
          <img
            src={link.thumbnailUrl || getFallbackImage()}
            alt={link.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${layoutMode === "grid" ? "from-slate-950/60 via-slate-950/20" : "from-slate-950/60 sm:from-transparent sm:via-transparent sm:bg-gradient-to-r sm:from-slate-950/20 sm:to-transparent"} to-transparent`}></div>
          {(link.isPinned || isPersonalPin) && (
            <div className={`absolute flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold text-rose-900 bg-rose-100/90 backdrop-blur-md rounded-full shadow-sm ${
              layoutMode === "grid" ? "top-2 right-2 sm:top-3.5 sm:right-3.5" : "top-2 left-2 sm:top-2 sm:left-2"
            }`}>
              <Pin className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              <span className="tracking-wide">{isPersonalPin && !link.isPinned ? "หมุดส่วนตัว" : "หมุดสำคัญ"}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex ${layoutMode === "grid" ? "flex-col p-3.5 sm:p-5" : layoutMode === "list" ? "flex-col justify-center p-3 sm:p-4 min-w-0" : "flex-row items-center justify-between min-w-0 gap-3 w-full"}`}>
        
        <div className={`flex ${layoutMode === "compact" ? "items-center flex-1 min-w-0 gap-3" : "items-start gap-2 sm:gap-3 mb-1.5 sm:mb-2.5"} `}>
          
          <div className={`flex items-center justify-center rounded-lg sm:rounded-xl bg-[#5c0620]/5 text-[#5c0620] group-hover:bg-[#5c0620]/10 transition-colors border border-[#5c0620]/10 shrink-0 ${
            layoutMode === "compact" ? "w-8 h-8 sm:w-10 sm:h-10 mt-0" : "w-7 h-7 sm:w-8.5 sm:h-8.5 mt-0.5"
          }`}>
            <DynamicIcon name="Link" className={`${layoutMode === "compact" ? "w-4 h-4 sm:w-5 sm:h-5" : "w-3.5 sm:w-4.5 h-3.5 sm:h-4.5"} text-[#5c0620]`} />
          </div>
          
          <div className={`${layoutMode === "compact" ? "flex flex-col flex-1 min-w-0" : ""}`}>
            <div className="flex items-center gap-2">
              {layoutMode === "compact" && (link.isPinned || isPersonalPin) && (
                <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              )}
              <h3 className={`font-extrabold text-slate-800 group-hover:text-[#5c0620] transition-colors leading-snug break-words ${
                layoutMode === "compact" ? "text-sm sm:text-base" : "text-[12px] sm:text-[14px]"
              }`}>
                {link.title}
              </h3>
            </div>
            {layoutMode !== "grid" && (
              <p className={`text-[10px] sm:text-xs text-slate-500 font-light leading-relaxed break-words ${
                layoutMode === "compact" ? "mt-0.5" : "mt-1"
              }`}>
                {link.description || "ไม่มีคำอธิบายเพิ่มเติม"}
              </p>
            )}
          </div>
        </div>

        {layoutMode === "grid" && (
          <p className="text-[10px] sm:text-xs text-slate-500 min-h-[1.25rem] pl-0.5 sm:pl-1 font-light leading-relaxed break-words">
            {link.description || "ไม่มีคำอธิบายเพิ่มเติม"}
          </p>
        )}

        {/* Footer / Actions for List & Compact */}
        {layoutMode !== "grid" && (
          <div className={`${layoutMode === "compact" ? "shrink-0 ml-3" : "mt-2 sm:mt-auto flex items-center justify-between"}`}>
            {layoutMode === "list" && (
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 font-mono">
                <BarChart2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#5c0620]/40" />
                <span>คลิก: {link.clickCount || 0}</span>
              </div>
            )}
            
            <div className={`flex items-center ${layoutMode === "compact" ? "gap-0.5" : "gap-1"}`}>
              <button onClick={handleCopy} className="p-1.5 rounded-lg text-slate-400 hover:text-[#5c0620] hover:bg-[#5c0620]/5 transition-colors" title="คัดลอกลิงก์">
                {copied ? <Check className="w-4 h-4 text-[#5c0620]" /> : <Copy className="w-4 h-4" />}
              </button>
              {isAdmin && (
                <>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit && onEdit(link); }} className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors" title="แก้ไข">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete && onDelete(link.id); }} className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors" title="ลบ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <span className="p-1.5 rounded-lg text-slate-300 group-hover:text-[#5c0620] group-hover:bg-[#5c0620]/5 transition-colors ml-0.5">
                <ExternalLink className="w-4 h-4" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer of Card (Only for Grid) */}
      {layoutMode === "grid" && (
        <div className="px-3.5 sm:px-5 pb-3 sm:pb-4 pt-2 sm:pt-3 border-t border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-[9px] sm:text-[11px] text-slate-400 font-mono">
            <BarChart2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#5c0620]/40" />
            <span>คลิก: {link.clickCount || 0}</span>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleCopy} className="p-1.5 rounded-lg text-slate-400 hover:text-[#5c0620] hover:bg-[#5c0620]/5 transition-colors" title="คัดลอกลิงก์">
              {copied ? <Check className="w-4 h-4 text-[#5c0620]" /> : <Copy className="w-4 h-4" />}
            </button>
            {isAdmin && (
              <>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit && onEdit(link); }} className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors" title="แก้ไข">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete && onDelete(link.id); }} className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors" title="ลบ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <span className="p-1.5 rounded-lg text-slate-300 group-hover:text-[#5c0620] group-hover:bg-[#5c0620]/5 transition-colors ml-0.5">
              <ExternalLink className="w-4 h-4" />
            </span>
          </div>
        </div>
      )}
    </motion.a>
  );
};

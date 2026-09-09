import React, { useEffect, useState, useMemo } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";

interface ParticleData {
  id: number;
  // Neat clustered position (polar coordinates converted to x, y)
  baseX: number;
  baseY: number;
  // Scatter target offsets when scrolled down
  scatterX: number;
  scatterY: number;
  // Visual properties
  size: number;
  color: string;
  glowColor: string;
  opacity: number;
  blur: number;
  isStarShape?: boolean;
  pulseDelay: number;
  pulseDuration: number;
}

export const LogoCelestialDust: React.FC = () => {
  const { scrollY } = useScroll();
  
  // Smooth spring for natural fluid motion when scrolling up/down
  const smoothScroll = useSpring(scrollY, {
    stiffness: 80,
    damping: 20,
    mass: 0.5
  });

  // Scroll factor 0 (top/neat cluster) to 1 (scrolled down/dispersed)
  // Reaches full scatter around 350px - 450px of scroll
  const scatterProgress = useTransform(smoothScroll, [0, 380], [0, 1]);

  // Generate deterministic celestial particles clustered neatly behind the logo
  const particles = useMemo<ParticleData[]>(() => {
    const list: ParticleData[] = [];
    let id = 0;

    // Palette of celestial starlight: starlight white, champagne gold, soft rose, and burgundy aura
    const colors = [
      { color: "#FFFFFF", glow: "rgba(255, 255, 255, 0.9)" },
      { color: "#FEF08A", glow: "rgba(254, 240, 138, 0.8)" },
      { color: "#FDE047", glow: "rgba(253, 224, 71, 0.75)" },
      { color: "#FDA4AF", glow: "rgba(253, 164, 175, 0.8)" },
      { color: "#F43F5E", glow: "rgba(244, 63, 94, 0.65)" },
      { color: "#FB7185", glow: "rgba(251, 113, 133, 0.7)" },
      { color: "#BE123C", glow: "rgba(190, 18, 60, 0.6)" },
    ];

    // Ring 1: Inner Core Constellation (8 particles, tightly and neatly clustered)
    const ring1Count = 8;
    const ring1Radius = 32;
    for (let i = 0; i < ring1Count; i++) {
      const angle = (i / ring1Count) * Math.PI * 2;
      const baseX = Math.cos(angle) * ring1Radius;
      const baseY = Math.sin(angle) * ring1Radius;

      // Scatter outward in their radial direction + some vertical drift
      const scatterDist = 140 + (i % 3) * 45;
      const scatterAngle = angle + (Math.sin(i * 1.5) * 0.4);
      const scatterX = Math.cos(scatterAngle) * scatterDist + (Math.cos(i) * 30);
      const scatterY = Math.sin(scatterAngle) * scatterDist + 50 + (i % 2 === 0 ? 40 : -30);

      const pal = colors[i % colors.length];
      list.push({
        id: id++,
        baseX,
        baseY,
        scatterX,
        scatterY,
        size: i % 2 === 0 ? 4.5 : 3,
        color: pal.color,
        glowColor: pal.glow,
        opacity: 0.95,
        blur: 0,
        isStarShape: i % 3 === 0,
        pulseDelay: (i * 0.3) % 2,
        pulseDuration: 2.2 + (i % 3) * 0.4
      });
    }

    // Ring 2: Mid Symmetrical Galaxy Ring (16 particles, perfectly balanced)
    const ring2Count = 16;
    const ring2Radius = 56;
    for (let i = 0; i < ring2Count; i++) {
      const angle = (i / ring2Count) * Math.PI * 2 + (Math.PI / 16);
      const baseX = Math.cos(angle) * ring2Radius;
      const baseY = Math.sin(angle) * ring2Radius;

      // Scatter outward horizontally and diagonally
      const scatterDist = 200 + (i % 4) * 60;
      const scatterAngle = angle + (i % 2 === 0 ? 0.2 : -0.2);
      const scatterX = Math.cos(scatterAngle) * scatterDist * 1.4; // wider horizontal scatter
      const scatterY = Math.sin(scatterAngle) * scatterDist + (i % 3 === 0 ? 70 : -20);

      const pal = colors[(i + 2) % colors.length];
      list.push({
        id: id++,
        baseX,
        baseY,
        scatterX,
        scatterY,
        size: i % 4 === 0 ? 5 : i % 2 === 0 ? 3.5 : 2.5,
        color: pal.color,
        glowColor: pal.glow,
        opacity: 0.88,
        blur: i % 5 === 0 ? 1 : 0,
        isStarShape: i % 2 === 0,
        pulseDelay: (i * 0.2) % 2.5,
        pulseDuration: 2.5 + (i % 4) * 0.3
      });
    }

    // Ring 3: Outer Geometric Halo (20 particles, neat perimeter)
    const ring3Count = 20;
    const ring3Radius = 82;
    for (let i = 0; i < ring3Count; i++) {
      const angle = (i / ring3Count) * Math.PI * 2;
      const baseX = Math.cos(angle) * ring3Radius;
      const baseY = Math.sin(angle) * ring3Radius;

      // Scatter broadly into a wide starfield across the header
      const scatterDist = 260 + (i % 5) * 75;
      const scatterAngle = angle + (Math.cos(i) * 0.35);
      const scatterX = Math.cos(scatterAngle) * scatterDist * 1.6;
      const scatterY = Math.sin(scatterAngle) * (scatterDist * 0.9) + 40;

      const pal = colors[(i + 4) % colors.length];
      list.push({
        id: id++,
        baseX,
        baseY,
        scatterX,
        scatterY,
        size: i % 3 === 0 ? 4 : 2,
        color: pal.color,
        glowColor: pal.glow,
        opacity: 0.8,
        blur: i % 4 === 0 ? 1 : 0,
        isStarShape: i % 4 === 0,
        pulseDelay: (i * 0.15) % 3,
        pulseDuration: 2.8 + (i % 3) * 0.5
      });
    }

    // Ring 4: Ambient Nebulous Fine Dust (12 soft micro-particles for depth)
    const ring4Count = 12;
    const ring4Radius = 42;
    for (let i = 0; i < ring4Count; i++) {
      const angle = (i / ring4Count) * Math.PI * 2 + 0.3;
      const baseX = Math.cos(angle) * ring4Radius;
      const baseY = Math.sin(angle) * ring4Radius;

      const scatterX = (Math.cos(angle) * 320) + (i % 2 === 0 ? 60 : -60);
      const scatterY = (Math.sin(angle) * 180) + 90;

      list.push({
        id: id++,
        baseX,
        baseY,
        scatterX,
        scatterY,
        size: 2,
        color: i % 2 === 0 ? "#FFFFFF" : "#FED7AA",
        glowColor: "rgba(255, 255, 255, 0.6)",
        opacity: 0.7,
        blur: 1.5,
        isStarShape: false,
        pulseDelay: i * 0.25,
        pulseDuration: 3
      });
    }

    return list;
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-visible select-none">
      {/* Central Nebulous Soft Aura Glow (Softens & expands when dispersed) */}
      <motion.div
        style={{
          scale: useTransform(scatterProgress, [0, 1], [1, 2.2]),
          opacity: useTransform(scatterProgress, [0, 1], [0.85, 0.4]),
        }}
        className="absolute w-44 h-44 rounded-full bg-radial from-rose-500/30 via-[#5c0620]/20 to-transparent blur-2xl pointer-events-none"
      />

      {/* Neat Celestial Rings Guide (Subtle harmonic lines in cluster state) */}
      <motion.div
        style={{
          opacity: useTransform(scatterProgress, [0, 0.35, 1], [0.4, 0.1, 0]),
          scale: useTransform(scatterProgress, [0, 1], [1, 1.4]),
        }}
        className="absolute w-[164px] h-[164px] rounded-full border border-rose-300/30 border-dashed pointer-events-none"
      />
      <motion.div
        style={{
          opacity: useTransform(scatterProgress, [0, 0.35, 1], [0.35, 0.05, 0]),
          scale: useTransform(scatterProgress, [0, 1], [1, 1.3]),
        }}
        className="absolute w-[112px] h-[112px] rounded-full border border-yellow-200/25 pointer-events-none"
      />

      {/* The Starlike Glowing Particles */}
      {particles.map((p) => {
        return (
          <ParticleItem 
            key={p.id} 
            data={p} 
            scatterProgress={scatterProgress} 
          />
        );
      })}
    </div>
  );
};

// Individual particle component with scroll-linked coordinate transform & idle twinkle
const ParticleItem: React.FC<{
  data: ParticleData;
  scatterProgress: any;
}> = ({ data, scatterProgress }) => {
  // Interpolate X and Y from base clustered position (at scroll 0) to scattered position (scrolled down)
  const x = useTransform(scatterProgress, [0, 1], [data.baseX, data.scatterX]);
  const y = useTransform(scatterProgress, [0, 1], [data.baseY, data.scatterY]);
  
  // Scale and opacity dynamics on scatter
  const scale = useTransform(
    scatterProgress,
    [0, 0.5, 1],
    [1, 1.25, data.isStarShape ? 1.4 : 0.9]
  );
  
  const opacity = useTransform(
    scatterProgress,
    [0, 1],
    [data.opacity, Math.max(0.35, data.opacity * 0.75)]
  );

  // Rotation expands during scroll
  const rotate = useTransform(
    scatterProgress,
    [0, 1],
    [0, data.id % 2 === 0 ? 180 : -180]
  );

  return (
    <motion.div
      style={{
        x,
        y,
        scale,
        opacity,
        rotate,
        position: "absolute",
      }}
      className="flex items-center justify-center pointer-events-none transform-gpu will-change-transform"
    >
      {/* Idle twinkle animation */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.85, 1, 0.85],
        }}
        transition={{
          repeat: Infinity,
          duration: data.pulseDuration,
          delay: data.pulseDelay,
          ease: "easeInOut",
        }}
        style={{
          width: data.size,
          height: data.size,
          filter: data.blur ? `blur(${data.blur}px)` : undefined,
        }}
        className="relative flex items-center justify-center"
      >
        {data.isStarShape ? (
          // 4-pointed Star Sparkle
          <div className="relative flex items-center justify-center">
            {/* Horizontal beam */}
            <div
              style={{
                backgroundColor: data.color,
                boxShadow: `0 0 ${data.size * 2}px ${data.glowColor}, 0 0 ${data.size * 3.5}px ${data.glowColor}`,
                width: data.size * 2.6,
                height: Math.max(1, data.size * 0.4),
              }}
              className="rounded-full"
            />
            {/* Vertical beam */}
            <div
              style={{
                backgroundColor: data.color,
                boxShadow: `0 0 ${data.size * 2}px ${data.glowColor}`,
                height: data.size * 2.6,
                width: Math.max(1, data.size * 0.4),
              }}
              className="absolute rounded-full"
            />
            {/* Central bright core */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                boxShadow: `0 0 6px #FFFFFF`,
                width: data.size * 0.8,
                height: data.size * 0.8,
              }}
              className="absolute rounded-full"
            />
          </div>
        ) : (
          // Soft Glowing Starlight Dot / Nebula Dust
          <div
            style={{
              backgroundColor: data.color,
              boxShadow: `0 0 ${data.size * 2.5}px ${data.glowColor}, 0 0 ${data.size * 5}px ${data.glowColor}`,
              width: data.size,
              height: data.size,
            }}
            className="rounded-full"
          />
        )}
      </motion.div>
    </motion.div>
  );
};

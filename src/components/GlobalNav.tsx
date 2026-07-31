import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Swords, Map, UserPlus,
  ChevronDown, X, Loader2, Gamepad2, Star
} from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import { useGamePanel } from "@/context/GamePanelContext";
import { findTeamLogo } from "@/lib/brawl-utils";
import type { PanelEntry } from "@/lib/game-types";
import type { ProTeamMeta } from "@/lib/brawl-utils";

/* ── Open Games dropdown item ────────────────────────────────────── */
function OpenGameItem({
  panel, isActive, onClick, onClose, proTeams,
}: {
  key?: any;
  panel: PanelEntry;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  proTeams: ProTeamMeta[];
}) {
  const t1logo = findTeamLogo(panel.baseGame.team1Name, panel.baseGame.team1Code, proTeams);
  const t2logo = findTeamLogo(panel.baseGame.team2Name, panel.baseGame.team2Code, proTeams);

  // For non-top-16 teams (no logo): show first player vs first player
  const t1HasLogo = !!t1logo;
  const t2HasLogo = !!t2logo;
  const t1Display = t1HasLogo
    ? panel.baseGame.team1Name
    : panel.baseGame.team1Picks?.[0]?.player?.replace(/^[A-Z0-9]+\|/i, "") || panel.baseGame.team1Name;
  const t2Display = t2HasLogo
    ? panel.baseGame.team2Name
    : panel.baseGame.team2Picks?.[0]?.player?.replace(/^[A-Z0-9]+\|/i, "") || panel.baseGame.team2Name;

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-border/20 last:border-0 transition-colors ${
      isActive ? "bg-primary/8" : "hover:bg-white/[0.05]"
    }`}>
      <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={onClick}>
        <div className="flex items-center gap-1.5 min-w-0">
          {t1logo && (
            <img src={t1logo} alt="" className="w-4 h-4 object-contain rounded shrink-0 opacity-80"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className={`text-[11px] font-mono font-semibold truncate max-w-[70px] ${isActive ? "text-primary" : "text-foreground/85"}`}>
            {t1Display}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">vs</span>
          <span className={`text-[11px] font-mono font-semibold truncate max-w-[70px] ${isActive ? "text-primary" : "text-foreground/85"}`}>
            {t2Display}
          </span>
          {t2logo && (
            <img src={t2logo} alt="" className="w-4 h-4 object-contain rounded shrink-0 opacity-80"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        {panel.loading && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-muted-foreground/50 ml-1" />}
        {panel.baseGame.roundName && (
          <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0 truncate">{panel.baseGame.roundName}</span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="text-muted-foreground/35 hover:text-red-400 transition-colors p-0.5 shrink-0"
        title="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Main global nav ─────────────────────────────────────────────── */
export function GlobalNav() {
  const { lang, setLang, t } = useLanguage();
  const { panels, activePanel, setActivePanel, closePanel, proTeams } = useGamePanel();
  const [openGamesOpen, setOpenGamesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [location, navigate] = useLocation();

  // Close dropdown on outside click
  useEffect(() => {
    if (!openGamesOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpenGamesOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGamesOpen]);

  // Close dropdown when all panels are closed
  useEffect(() => {
    if (panels.length === 0) setOpenGamesOpen(false);
  }, [panels.length]);

  function handleGameClick(key: string) {
    setActivePanel(key);
    navigate("/match");
    setOpenGamesOpen(false);
  }

  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  const navLinkClass = (path: string, hover: string) => {
    const active = isActive(path);
    return `relative text-[11px] font-mono font-semibold uppercase transition-colors tracking-widest flex items-center gap-1.5 shrink-0 h-14 ${
      active ? hover.replace('hover:', '') : `text-muted-foreground ${hover}`
    }`;
  };

  return (
    <>
      {/* ── Sticky top nav ─────────────────────────────────────────── */}
      <header className="w-full bg-card/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        
        <div className="max-w-[1800px] mx-auto px-5 h-14 flex items-center gap-2 overflow-x-auto custom-scrollbar" style={{ overflowY: "visible" }}>
          {/* Logo */}
          <Link href="/" className="font-mono font-black text-primary tracking-widest text-sm flex items-center gap-2 mr-3 shrink-0 group">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
              <Star className="w-4 h-4 text-primary absolute opacity-50 blur-[2px]" />
              <Star className="w-3.5 h-3.5 text-primary relative z-10" />
            </div>
            Brawl Analytics
          </Link>

          {/* Primary nav links */}
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/pro-teams" className={navLinkClass("/pro-teams", "hover:text-indigo-400")}>
              <Users className="w-3.5 h-3.5" /> {t.nav_pro_teams}
              {isActive("/pro-teams") && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />}
            </Link>
            <Link href="/scrims" className={navLinkClass("/scrims", "hover:text-orange-400")}>
              <Swords className="w-3.5 h-3.5" /> {t.nav_scrims}
              {isActive("/scrims") && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
            </Link>
            <Link href="/maps" className={navLinkClass("/maps", "hover:text-emerald-400")}>
              <Map className="w-3.5 h-3.5" /> {t.nav_maps}
              {isActive("/maps") && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
            </Link>
            <Link href="/matcherino" className={navLinkClass("/matcherino", "hover:text-violet-400")}>
              <Trophy className="w-3.5 h-3.5" /> Matcherino
              {isActive("/matcherino") && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />}
            </Link>
            {/* Custom Team functionality temporarily deactivated
            <Link href="/custom-team" className={navLinkClass("/custom-team", "hover:text-purple-400")}>
              <UserPlus className="w-3.5 h-3.5" /> Custom Team
              {isActive("/custom-team") && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />}
            </Link>
            */}

            {/* ── Open Games dropdown — only visible when panels are open ── */}
            <AnimatePresence>
              {panels.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  ref={dropdownRef}
                  className="relative shrink-0 flex items-center h-14"
                >
                  <button
                    onClick={() => setOpenGamesOpen((o) => !o)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono font-semibold uppercase tracking-widest transition-all ${
                      openGamesOpen
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "bg-white/5 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                    }`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    Open Games
                    <span className="bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0 rounded-full leading-5 min-w-[18px] text-center">
                      {panels.length}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${openGamesOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {openGamesOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.1 }}
                        className="absolute top-12 mt-1.5 left-0 z-50 min-w-[280px] bg-card/98 border border-border/60 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden"
                      >
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
                          <span className="text-[9px] font-mono font-black text-muted-foreground/50 uppercase tracking-widest">
                            Open Games · {panels.length}
                          </span>
                          <button
                            onClick={() => { panels.forEach((p) => closePanel(p.key)); setOpenGamesOpen(false); }}
                            className="text-[9px] font-mono text-red-400/60 hover:text-red-400 transition-colors"
                          >
                            Close all
                          </button>
                        </div>
                        {/* Game items */}
                        {panels.map((p) => (
                          <OpenGameItem
                            key={p.key}
                            panel={p}
                            isActive={p.key === activePanel}
                            onClick={() => handleGameClick(p.key)}
                            onClose={() => closePanel(p.key)}
                            proTeams={proTeams}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right side controls */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 bg-black/40 rounded border border-border/40 p-0.5">
              <button
                onClick={() => setLang("de")}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                  lang === "de" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >DE</button>
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                  lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >EN</button>
            </div>
            <a
              href="https://discord.com/users/thegoatbeni"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#5865F2]/10 border border-[#5865F2]/20 hover:border-[#5865F2]/40 transition-colors text-[#5865F2] hover:text-[#7289da]"
              title="@thegoatbeni on Discord"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              <span className="text-[10px] font-mono font-bold hidden sm:inline-block">@thegoatbeni</span>
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

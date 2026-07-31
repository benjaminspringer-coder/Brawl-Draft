import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowLeft, Users, Search, X, Swords, Trophy, Activity, Star,
  BarChart2, Shield, ChevronDown, TrendingUp, Flame, Zap,
  Loader2, Filter, Target, Map, ChevronRight, User,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Legend, AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamStats = {
  total: number; wins: number; losses: number; draws: number; winRate: number;
  bySource: { source: "scrim" | "matcherino"; games: number; wins: number; losses: number; wr: number }[];
  byMode: { mode: string; wins: number; losses: number; games: number; wr: number }[];
  byMap: { map: string; wins: number; losses: number; games: number; wr: number }[];
  byOpponent: { code: string; name: string; wins: number; losses: number; games: number; wr: number }[];
  byBrawler: { name: string; picks: number; bans: number; wins: number; losses: number; winRate: number }[];
  players: { name: string; games: number; wins: number; winRate: number; topBrawlers: { brawler: string; count: number }[] }[];
  timeline: { week: string; wr: number; games: number; wins: number }[];
  detectedTeamCode: string | null;
  detectedTeamName: string | null;
};

type UGPlayer = { name: string; brawler: string | null; brawlerId?: number | null; imageUrl?: string | null; isSubstitute?: boolean };
type UGBan = { brawler: string; imageUrl: string | null };
type UnifiedGame = {
  id: string; source: "scrim" | "matcherino"; time: string;
  mode: string; map: string; result: "W" | "L" | "D";
  opponentCode: string | null; opponentName: string; myTeamName: string;
  myPlayers: UGPlayer[]; oppPlayers: UGPlayer[];
  myBans: UGBan[]; oppBans: UGBan[];
  tournamentName: string | null; roundName: string | null; scoreline: string | null;
  isTournamentScrim: boolean;
};

type Scrim = {
  id: number; scrimId: string; time: string; mode: string; map: string;
  duration: number | null; scoreline: string | null; isTournament: boolean;
  winnerTeamCode: string | null;
  team1Code: string | null; team1Name: string | null;
  team2Code: string | null; team2Name: string | null;
  team1Players: any[]; team2Players: any[];
  mvpPlayer: string | null; mvpTeam: string | null;
  customSide: "team1" | "team2"; customWon: boolean; overlapCount: number;
};

type DraftEntry = { team: string; value: string; imageUrl?: string | null; type: string; playerName?: string | null };
type MapDraft = {
  mapName: string; gameMode?: string | null; action: string; winner?: string | null;
  team1Score?: number | null; team2Score?: number | null;
  picks: DraftEntry[]; bans: DraftEntry[];
};
type MatchEntry = {
  id: number; tournamentId: number; tournamentName: string;
  team1Name: string; team2Name: string; winnerName: string | null;
  score: string | null; roundName: string | null; maps: MapDraft[]; createdAt: string;
  matchedSide: "team1" | "team2"; matchMethod: string; overlapCount?: number;
};

type BrawlerStat = {
  name: string; picks: number; bans: number; wins: number; losses: number;
  winRate: number; presence: number;
  byMode: { mode: string; games: number; wins: number; winRate: number }[];
  teammates: { brawler: string; games: number; wins: number; winRate: number; score: number }[];
  counters: { brawler: string; games: number; winsAgainst: number; winRate: number; score: number }[];
  timeline: { date: string; games: number; wins: number; winRate: number }[];
};
type BrawlerStatsResponse = { brawlers: BrawlerStat[]; allBrawlers: string[]; allMaps: string[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_IMAGES: Record<string, string> = {
  "Hard Rock Mine": "https://static.wikia.nocookie.net/brawlstars/images/b/bf/Hard_Rock_Mine-Map.png/revision/latest",
  "Gem Fort": "https://static.wikia.nocookie.net/brawlstars/images/9/95/Gem_Fort-Map.png/revision/latest",
  "Crystal Arcade": "https://static.wikia.nocookie.net/brawlstars/images/0/06/Crystal_Arcade-Map.png/revision/latest",
  "Goldarm Gulch": "https://static.wikia.nocookie.net/brawlstars/images/3/3b/Goldarm_Gulch-Map.png/revision/latest",
  "New Horizons": "https://static.wikia.nocookie.net/brawlstars/images/5/5d/New_Horizons-Map.png/revision/latest",
  "Out in the Open": "https://static.wikia.nocookie.net/brawlstars/images/8/8c/Out_in_the_Open-Map.png/revision/latest",
  "Triple Dribble": "https://static.wikia.nocookie.net/brawlstars/images/e/e9/Triple_Dribble-Map.png/revision/latest",
  "Pinhole Punt": "https://static.wikia.nocookie.net/brawlstars/images/c/ca/Pinhole_Punt-Map.png/revision/latest",
  "Pinball Dreams": "https://static.wikia.nocookie.net/brawlstars/images/e/e9/Pinball_Dreams-Map.png/revision/latest",
  "Dry Season": "https://static.wikia.nocookie.net/brawlstars/images/3/3c/Dry_Season-Map.png/revision/latest",
  "Hideout": "https://static.wikia.nocookie.net/brawlstars/images/9/9d/Hideout-Map.png/revision/latest",
  "Layer Cake": "https://static.wikia.nocookie.net/brawlstars/images/a/af/Layer_Cake-Map.png/revision/latest",
  "Pit Stop": "https://static.wikia.nocookie.net/brawlstars/images/7/74/Pit_Stop-Map.png/revision/latest",
  "Safe Zone": "https://static.wikia.nocookie.net/brawlstars/images/a/ab/Safe_Zone-Map.png/revision/latest",
  "Kaboom Canyon": "https://static.wikia.nocookie.net/brawlstars/images/a/a5/Kaboom_Canyon-Map.png/revision/latest",
  "Ring of Fire": "https://static.wikia.nocookie.net/brawlstars/images/7/7a/Ring_of_Fire-Map.png/revision/latest",
  "Open Business": "https://static.wikia.nocookie.net/brawlstars/images/2/22/Open_Business-Map.png/revision/latest",
  "Dueling Beetles": "https://static.wikia.nocookie.net/brawlstars/images/5/51/Dueling_Beetles-Map.png/revision/latest",
};

const MODE_ICONS: Record<string, string> = {
  bounty: "🎯", heist: "💥", hotZone: "🔥", brawlBall: "⚽", gemGrab: "💎", knockout: "☠️",
};
const MODE_LABEL: Record<string, string> = {
  bounty: "Bounty", heist: "Heist", hotZone: "Hot Zone",
  brawlBall: "Brawl Ball", gemGrab: "Gem Grab", knockout: "Knockout",
};
const MAP_EMOJI: Record<string, string> = {
  "Goldarm Gulch": "☠️", "New Horizons": "☠️", "Out in the Open": "☠️",
  "Hard Rock Mine": "💎", "Gem Fort": "💎", "Crystal Arcade": "💎",
  "Triple Dribble": "⚽", "Pinhole Punt": "⚽", "Pinball Dreams": "⚽",
  "Dry Season": "🎯", "Hideout": "🎯", "Layer Cake": "🎯",
  "Pit Stop": "💥", "Safe Zone": "💥", "Kaboom Canyon": "💥",
  "Ring of Fire": "🔥", "Open Business": "🔥", "Dueling Beetles": "🔥",
};

const CHART_COLORS = ["#22c55e", "#3b82f6", "#eab308", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#ec4899"];

const PLAYER_TABS = [
  { key: "overview",   label: "Overview",    icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "games",      label: "Games",       icon: <Swords className="w-3.5 h-3.5" /> },
  { key: "brawlers",   label: "Brawlers",    icon: <Star className="w-3.5 h-3.5" /> },
  { key: "maps",       label: "Maps",        icon: <Map className="w-3.5 h-3.5" /> },
  { key: "analytics",  label: "Analytics",   icon: <BarChart2 className="w-3.5 h-3.5" /> },
] as const;
type PlayerTabKey = typeof PLAYER_TABS[number]["key"];

const TEAM_TABS = [
  { key: "overview",  label: "Overview",  icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "games",     label: "Games",     icon: <Swords className="w-3.5 h-3.5" /> },
  { key: "matches",   label: "Matches",   icon: <Activity className="w-3.5 h-3.5" /> },
  { key: "players",   label: "Players",   icon: <Users className="w-3.5 h-3.5" /> },
  { key: "brawlers",  label: "Brawlers",  icon: <Star className="w-3.5 h-3.5" /> },
  { key: "analytics", label: "Analytics", icon: <BarChart2 className="w-3.5 h-3.5" /> },
] as const;
type TeamTabKey = typeof TEAM_TABS[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBrawlerImg(name: string) {
  if (!name) return "";
  return `https://cdn.brawlify.com/brawler-bs/regular/${encodeURIComponent(name.toLowerCase().replace(/\s/g, "-"))}.png`;
}
function getBrawlerImgById(id: number) {
  return `https://cdn.brawlify.com/brawlers/borderless/${id}.png`;
}
function brawlerSrc(p: { brawler?: string | null; brawlerId?: number | null; imageUrl?: string | null }): string {
  if (p.imageUrl) return p.imageUrl;
  if (p.brawlerId) return getBrawlerImgById(p.brawlerId);
  return getBrawlerImg(p.brawler ?? "");
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}
function stripPrefix(s: string) { return s.replace(/^[A-Z0-9]+\s*\|\s*/i, ""); }

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

// ─── WrBadge ─────────────────────────────────────────────────────────────────

function WrBadge({ wr, games, size = "sm" }: { wr: number; games: number; size?: "sm" | "lg" }) {
  const color = games < 3 ? "text-white/40" : wr >= 60 ? "text-emerald-400" : wr >= 50 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-black ${size === "lg" ? "text-2xl" : "text-sm"} ${color}`}>{games > 0 ? `${wr}%` : "—"}</span>;
}

function WrBar({ wr, wins, losses }: { wr: number; wins: number; losses: number }) {
  return (
    <div className="space-y-1">
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${wr}%`, background: wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : "#ef4444" }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-emerald-400">{wins}W</span>
        <span className="text-red-400">{losses}L</span>
      </div>
    </div>
  );
}

// ─── BrawlerChip ─────────────────────────────────────────────────────────────

function BrawlerChip({ name, count, id }: { name: string; count?: number; id?: number; key?: any }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-white/10 rounded-lg">
      <img src={id ? getBrawlerImgById(id) : getBrawlerImg(name)} alt={name}
        className="w-5 h-5 object-contain rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <span className="text-[10px] font-mono text-white/80 capitalize">{name.toLowerCase()}</span>
      {count !== undefined && <span className="text-[9px] font-mono text-white/40">×{count}</span>}
    </div>
  );
}

// ─── SourceBadge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: "scrim" | "matcherino" }) {
  return source === "matcherino"
    ? <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">Matcherino</span>
    : <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">Scrim</span>;
}

// ─── SectionNav ──────────────────────────────────────────────────────────────

function SectionNav<T extends string>({ sections, active, onChange }: {
  sections: { key: T; label: string; icon: React.ReactNode }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {sections.map((s) => (
        <button key={s.key} onClick={() => onChange(s.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest border transition-all ${
            active === s.key
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground"
          }`}>
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── Player Autocomplete Input ────────────────────────────────────────────────

function PlayerInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debouncedQ = useDebounce(value.trim(), 200);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["/api/players/autocomplete", debouncedQ],
    queryFn: () => fetch(`/api/players/autocomplete?q=${encodeURIComponent(debouncedQ)}`).then((r) => r.json()),
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Users className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input type="text" value={value} disabled={disabled}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-card/40 border border-border/50 focus:border-primary/50 rounded-xl pl-9 pr-8 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-40"
        />
        {value && (
          <button onClick={() => { onChange(""); setOpen(false); }} className="absolute right-2.5 text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
            className="absolute top-full mt-1 left-0 right-0 bg-card/95 border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md max-h-52 overflow-y-auto">
            {suggestions.slice(0, 15).map((name) => (
              <button key={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(name); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm font-mono text-foreground hover:bg-white/8 transition-colors border-b border-border/20 last:border-0 flex items-center gap-2">
                <User className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <span className="truncate">{stripPrefix(name)}</span>
                {name.includes("|") && <span className="text-[9px] text-muted-foreground/40">{name.split("|")[0]}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Draft Grid Components ────────────────────────────────────────────────────

function BrawlerAvatar({ p, size = 7 }: { p: UGPlayer; size?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <img src={brawlerSrc(p)} alt={p.brawler ?? ""}
        className={`w-${size} h-${size} rounded-full bg-black/60 object-cover border border-white/10 shrink-0`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div className="min-w-0">
        <div className="text-[10px] font-mono font-bold text-foreground capitalize truncate">{(p.brawler ?? "?").toLowerCase()}</div>
        <div className="text-[9px] font-mono text-white/40 truncate">{stripPrefix(p.name ?? "")}</div>
      </div>
      {p.isSubstitute && <span className="text-[8px] text-yellow-400/70 font-mono ml-auto shrink-0">SUB</span>}
    </div>
  );
}

function ScrimDraftGrid({ myPlayers, oppPlayers, myName, oppName, won }: {
  myPlayers: any[]; oppPlayers: any[]; myName: string; oppName: string; won: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      {[
        { label: myName, players: myPlayers, isWinner: won },
        { label: oppName, players: oppPlayers, isWinner: !won },
      ].map(({ label, players, isWinner }) => (
        <div key={label} className={`bg-black/30 rounded-lg p-2.5 border ${isWinner ? "border-emerald-500/20" : "border-white/5"}`}>
          <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 truncate ${isWinner ? "text-emerald-400" : "text-muted-foreground"}`}>
            {isWinner && "🏆 "}{stripPrefix(label)}
          </div>
          <div className="space-y-1.5">
            {players.length === 0
              ? <div className="text-[9px] text-white/20 font-mono text-center py-2">—</div>
              : players.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={p.brawlerId ? getBrawlerImgById(p.brawlerId) : getBrawlerImg(p.brawler ?? "")}
                    alt={p.brawler} className="w-7 h-7 rounded-full bg-black/60 object-cover border border-white/10 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono font-bold text-foreground capitalize truncate">{(p.brawler ?? "?").toLowerCase()}</div>
                    <div className="text-[9px] font-mono text-white/40 truncate">{stripPrefix(p.name ?? "")}</div>
                  </div>
                  {p.isSubstitute && <span className="text-[8px] text-yellow-400/70 font-mono ml-auto shrink-0">SUB</span>}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnifiedDraftGrid({ g }: { g: UnifiedGame }) {
  const won = g.result === "W";
  const hasBans = g.myBans.length > 0 || g.oppBans.length > 0;
  return (
    <div className="mt-2 space-y-2.5">
      {hasBans && (
        <div className="bg-red-950/10 border border-white/5 rounded-lg px-3 py-2.5">
          <div className="text-[8px] font-mono text-red-400/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">🚫 Bans</div>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: g.myTeamName, entries: g.myBans }, { label: g.opponentName, entries: g.oppBans, right: true }].map(({ label, entries, right }: any) => (
              <div key={label} className={`flex flex-col gap-1 ${right ? "items-end" : ""}`}>
                <span className="text-[8px] font-mono text-white/30 truncate max-w-full">{stripPrefix(label)}</span>
                <div className={`flex flex-wrap gap-1 ${right ? "justify-end" : ""}`}>
                  {entries.length === 0 ? <span className="text-[9px] text-white/20 font-mono">—</span>
                    : entries.map((b: UGBan, i: number) => (
                      <div key={i} className="relative" title={b.brawler}>
                        <img src={b.imageUrl ?? getBrawlerImg(b.brawler)} alt={b.brawler}
                          className="w-7 h-7 rounded-full bg-black/60 object-cover border border-red-500/20 grayscale opacity-60"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full flex items-center justify-center shadow">
                          <X className="w-1.5 h-1.5 text-white" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: g.myTeamName, players: g.myPlayers, isWinner: won },
          { label: g.opponentName, players: g.oppPlayers, isWinner: !won && g.result === "L" },
        ].map(({ label, players, isWinner }) => (
          <div key={label} className={`bg-black/30 rounded-lg p-2.5 border ${isWinner ? "border-emerald-500/20" : "border-white/5"}`}>
            <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 truncate ${isWinner ? "text-emerald-400" : "text-muted-foreground"}`}>
              {isWinner && "🏆 "}{stripPrefix(label)}
            </div>
            <div className="space-y-1.5">
              {players.length === 0
                ? <div className="text-[9px] text-white/20 font-mono text-center py-2">—</div>
                : players.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <img src={brawlerSrc(p)} alt={p.brawler ?? ""}
                      className="w-7 h-7 rounded-full bg-black/60 object-cover border border-white/10 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono font-bold text-foreground capitalize truncate">{(p.brawler ?? "?").toLowerCase()}</div>
                      <div className="text-[9px] font-mono text-white/40 truncate">{stripPrefix(p.name ?? "")}</div>
                    </div>
                    {p.isSubstitute && <span className="text-[8px] text-yellow-400/70 font-mono ml-auto">SUB</span>}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapDraftPanel({ mp, myName, oppName, mapIndex, totalMaps }: { mp: MapDraft; myName: string; oppName: string; mapIndex?: number; totalMaps?: number; key?: any }) {
  const mapWon = mp.winner === myName;
  const mapLost = mp.winner !== null && mp.winner !== myName;
  const myPicks  = mp.picks.filter((p) => p.team === myName);
  const oppPicks = mp.picks.filter((p) => p.team === oppName);
  const myBans   = mp.bans.filter((b) => b.team === myName);
  const oppBans  = mp.bans.filter((b) => b.team === oppName);
  const hasBans  = myBans.length > 0 || oppBans.length > 0;
  const modeKey = mp.gameMode?.replace(/\s/g, "").replace(/^./, (c) => c.toLowerCase()) ?? "";
  const mapImg = MAP_IMAGES[mp.mapName];
  const isBanned = mp.action === "ban";
  const isDecider = mp.action === "decider";

  return (
    <div className={`relative bg-card/20 border rounded-xl overflow-hidden ${mapWon ? "border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.12)]" : mapLost ? "border-red-500/30" : isBanned ? "border-red-500/20 opacity-60" : "border-border/50"}`}>
      <div className="relative z-10">
        {/* Map header with large image */}
        <div className={`relative flex items-center justify-between px-3 py-3 border-b border-white/10 overflow-hidden ${mapWon ? "bg-emerald-950/40" : mapLost ? "bg-red-950/30" : "bg-black/50"}`}>
          {mapImg && (
            <div className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay pointer-events-none"
              style={{ backgroundImage: `url(${mapImg})` }} />
          )}
          <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
            {/* Map thumbnail */}
            {mapImg ? (
              <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/15 shrink-0 shadow-md">
                <img src={mapImg} alt={mp.mapName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                <span className="text-xl">{MAP_EMOJI[mp.mapName] ?? MODE_ICONS[modeKey] ?? "🗺️"}</span>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {typeof mapIndex === "number" && typeof totalMaps === "number" && totalMaps > 1 && (
                  <span className="text-[9px] font-mono font-bold text-muted-foreground/60 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 shrink-0 uppercase tracking-wider">
                    Map {mapIndex + 1}/{totalMaps}
                  </span>
                )}
                {isBanned && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">BANNED</span>}
                {isDecider && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 shrink-0">DECIDER</span>}
              </div>
              <div className="text-sm font-black font-mono text-foreground truncate mt-0.5">{mp.mapName}</div>
              {mp.gameMode && <div className="text-[9px] font-mono text-muted-foreground/70">{MAP_EMOJI[mp.mapName] ?? ""} {mp.gameMode}</div>}
            </div>
          </div>
          {mp.winner && (
            <span className={`relative z-10 shrink-0 text-sm font-black font-mono px-3 py-1 rounded-lg ${mapWon ? "text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-red-400 bg-red-500/10 border border-red-500/20"}`}>
              {mapWon ? "WIN" : "LOSS"}
            </span>
          )}
        </div>
        {hasBans && (
          <div className="px-3 py-2.5 border-b border-white/5 bg-red-950/20 backdrop-blur-sm">
            <div className="text-[8px] font-mono text-red-400/80 uppercase tracking-widest mb-2">🚫 Bans</div>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: myName, entries: myBans }, { label: oppName, entries: oppBans, right: true }].map(({ label, entries, right }: any) => (
                <div key={label} className={`flex flex-col gap-1 ${right ? "items-end" : ""}`}>
                  <span className="text-[8px] font-mono text-white/30">{stripPrefix(label)}</span>
                  <div className={`flex flex-wrap gap-1 ${right ? "justify-end" : ""}`}>
                    {entries.map((b: DraftEntry, i: number) => (
                      <div key={i} className="relative" title={b.value}>
                        <img src={b.imageUrl ?? getBrawlerImg(b.value)} alt={b.value}
                          className="w-7 h-7 rounded-full bg-black/60 object-cover border border-red-500/30 grayscale opacity-60"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full flex items-center justify-center"><X className="w-1.5 h-1.5 text-white" /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(myPicks.length > 0 || oppPicks.length > 0) && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-black/20 backdrop-blur-sm">
            {[{ label: myName, picks: myPicks, won: mapWon }, { label: oppName, picks: oppPicks, won: mapLost }].map(({ label, picks, won: w }) => (
              <div key={label} className={`bg-black/40 border rounded-lg p-2 ${w ? "border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "border-white/10"}`}>
                <div className={`text-[8px] font-mono uppercase tracking-widest mb-2 truncate ${w ? "text-emerald-400" : "text-muted-foreground"}`}>{w && "🏆 "}{stripPrefix(label)}</div>
                <div className="space-y-1.5">
                  {picks.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={pk.imageUrl ?? getBrawlerImg(pk.value)} alt={pk.value}
                        className="w-6 h-6 rounded-full bg-black/60 object-cover border border-white/20 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold text-foreground capitalize truncate">{pk.value.toLowerCase()}</div>
                        {pk.playerName && <div className="text-[9px] font-mono text-white/40 truncate">{stripPrefix(pk.playerName)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Games List (shared) ──────────────────────────────────────────────────────

function GamesList({ games }: { games: UnifiedGame[] | undefined }) {
  const [sourceFilter, setSourceFilter] = useState<"" | "scrim" | "matcherino">("");
  const [modeFilter, setModeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<"" | "W" | "L">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allModes = useMemo(() => [...new Set((games ?? []).map((g) => g.mode).filter(Boolean))].sort(), [games]);
  const filtered = useMemo(() => (games ?? []).filter((g) => {
    if (sourceFilter && g.source !== sourceFilter) return false;
    if (modeFilter && g.mode !== modeFilter) return false;
    if (resultFilter && g.result !== resultFilter) return false;
    return true;
  }), [games, sourceFilter, modeFilter, resultFilter]);

  if (!games) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-0.5 bg-black/40 border border-border/40 rounded-lg p-0.5">
          {([["", "Alle"], ["scrim", "Scrim"], ["matcherino", "Matcherino"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSourceFilter(v)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${sourceFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}
          className="bg-card/40 border border-border/40 text-xs font-mono rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50">
          <option value="">Alle Modi</option>
          {allModes.map((m) => <option key={m} value={m}>{MODE_LABEL[m] ?? m}</option>)}
        </select>
        <div className="flex gap-0.5 bg-black/40 border border-border/40 rounded-lg p-0.5">
          {(["", "W", "L"] as const).map((v) => (
            <button key={v} onClick={() => setResultFilter(v)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${resultFilter === v ? (v === "W" ? "bg-emerald-600/80 text-white" : v === "L" ? "bg-red-600/80 text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:text-foreground"}`}>
              {v || "All"}
            </button>
          ))}
        </div>
        {(sourceFilter || modeFilter || resultFilter) && (
          <button onClick={() => { setSourceFilter(""); setModeFilter(""); setResultFilter(""); }}
            className="px-3 py-1.5 text-[10px] font-mono font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 flex items-center gap-1">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{filtered.length} Spiele</span>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border/40 rounded-xl">
            <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm font-mono">Keine Spiele für diesen Filter.</p>
          </div>
        )}
        {filtered.map((g) => {
          const isOpen = expandedId === g.id;
          const won = g.result === "W", lost = g.result === "L";
          const mapImg = MAP_IMAGES[g.map];
          return (
            <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`bg-card/20 border rounded-xl overflow-hidden ${isOpen ? "border-primary/30" : "border-border/30"}`}>
              <div onClick={() => setExpandedId(isOpen ? null : g.id)}
                className="flex items-center gap-0 cursor-pointer hover:bg-white/3 transition-colors select-none">
                {/* Map thumbnail strip */}
                <div className="relative w-16 shrink-0 self-stretch overflow-hidden">
                  {mapImg ? (
                    <>
                      <img src={mapImg} alt={g.map} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/80" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-2xl opacity-60">{MODE_ICONS[g.mode] ?? "🎮"}</span>
                    </div>
                  )}
                  <div className={`absolute inset-x-0 top-0 h-full flex items-center justify-center`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black font-mono shadow-lg ${won ? "bg-emerald-500/90 text-white" : lost ? "bg-red-500/80 text-white" : "bg-white/10 text-white/50"}`}>
                      {won ? "W" : lost ? "L" : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-0 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black font-mono text-foreground truncate">vs {stripPrefix(g.opponentName)}</span>
                      <SourceBadge source={g.source} />
                      {g.isTournamentScrim && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400">Turnier</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">{g.map} · {MODE_LABEL[g.mode] ?? g.mode}{g.tournamentName ? ` · ${g.tournamentName}` : ""}</div>
                    {!isOpen && g.myPlayers.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {g.myPlayers.map((p, i) => (
                          <img key={i} src={brawlerSrc(p)} alt={p.brawler ?? ""}
                            className="w-4 h-4 rounded-full bg-black/40 object-cover border border-white/10"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {g.scoreline && <div className="text-xs font-black font-mono">{g.scoreline}</div>}
                      <div className="text-[9px] text-muted-foreground font-mono">{formatDate(g.time)}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                    <div className="border-t border-border/30 bg-black/25 px-3 pb-3 pt-2.5">
                      <UnifiedDraftGrid g={g} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Brawler Detail Panel (custom-team) ───────────────────────────────────────

function CustomBrawlerDetailPanel({ b }: { b: BrawlerStat }) {
  const wr = b.winRate;

  const weeklyTimeline = useMemo(() => {
    const byWeek: Record<string, { games: number; wins: number }> = {};
    for (const d of (b.timeline ?? [])) {
      const date = new Date(d.date);
      const mon = new Date(date); mon.setDate(date.getDate() - date.getDay() + 1);
      const key = `${String(mon.getMonth() + 1).padStart(2, "0")}/${String(mon.getDate()).padStart(2, "0")}`;
      if (!byWeek[key]) byWeek[key] = { games: 0, wins: 0 };
      byWeek[key].games += d.games; byWeek[key].wins += d.wins;
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, v]) => ({ week, games: v.games, wins: v.wins, wr: v.games ? Math.round(v.wins / v.games * 100) : 0 }));
  }, [b.timeline]);

  const gradId = `ct-spark-${b.name.replace(/\s/g, "_")}`;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="px-4 pb-4 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Win Rate", value: `${wr}%`, color: wr >= 60 ? "text-emerald-400" : wr >= 50 ? "text-yellow-400" : "text-red-400" },
          { label: "Picks", value: b.picks, color: "text-foreground" },
          { label: "Bans", value: b.bans, color: "text-orange-400" },
          { label: "Presence", value: `${b.presence.toFixed(1)}%`, color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-black/40 border border-white/8 rounded-lg p-3 text-center">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{label}</div>
            <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sparkline */}
        {weeklyTimeline.length >= 2 && (
          <div className="bg-black/30 border border-white/6 rounded-lg p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Pick-Aktivität</div>
            <ResponsiveContainer width="100%" height={70}>
              <AreaChart data={weeklyTimeline} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fill: "#444", fontSize: 8 }} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0e0e18] border border-white/10 rounded px-2 py-1 text-[10px] font-mono">
                      <p className="text-primary font-bold">{d.games}g · {d.wr}%</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="games" stroke="#6366f1" fill={`url(#${gradId})`} strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-mode bars */}
        {(b.byMode ?? []).length > 0 && (
          <div className="bg-black/30 border border-white/6 rounded-lg p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Nach Modus</div>
            <div className="space-y-1.5">
              {b.byMode.slice(0, 6).map((m) => {
                const col = m.winRate >= 60 ? "#22c55e" : m.winRate >= 50 ? "#eab308" : "#ef4444";
                return (
                  <div key={m.mode} className="flex items-center gap-2">
                    <span className="text-[10px] w-4 shrink-0">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.winRate}%`, background: col }} />
                    </div>
                    <span className="text-[9px] font-mono w-7 text-right shrink-0" style={{ color: col }}>{m.winRate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Teammates + Counters */}
      {((b.teammates?.length ?? 0) > 0 || (b.counters?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {(b.teammates?.length ?? 0) > 0 && (
            <div className="bg-black/30 border border-white/6 rounded-lg p-3">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Top Teammates</div>
              <div className="flex flex-wrap gap-1">
                {b.teammates.slice(0, 6).map((t) => (
                  <div key={t.brawler} className="flex items-center gap-1 px-2 py-1 bg-emerald-500/8 border border-emerald-500/15 rounded-lg">
                    <img src={getBrawlerImg(t.brawler)} alt={t.brawler} className="w-4 h-4 object-contain rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-[9px] font-mono text-emerald-300 capitalize">{t.brawler.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(b.counters?.length ?? 0) > 0 && (
            <div className="bg-black/30 border border-white/6 rounded-lg p-3">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Schwächen vs.</div>
              <div className="flex flex-wrap gap-1">
                {b.counters.slice(0, 6).map((c) => (
                  <div key={c.brawler} className="flex items-center gap-1 px-2 py-1 bg-red-500/8 border border-red-500/15 rounded-lg">
                    <img src={getBrawlerImg(c.brawler)} alt={c.brawler} className="w-4 h-4 object-contain rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-[9px] font-mono text-red-300 capitalize">{c.brawler.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Brawler Table (shared) ───────────────────────────────────────────────────

function BrawlerTable({ playerParam }: { playerParam: string }) {
  const [mapFilter, setMapFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"picks" | "wr" | "presence" | "bans">("picks");
  const [expandedBrawler, setExpandedBrawler] = useState<string | null>(null);

  const { data } = useQuery<BrawlerStatsResponse>({
    queryKey: ["/api/brawler-stats", "custom", playerParam, mapFilter, modeFilter, sourceFilter],
    queryFn: () => {
      const p = new URLSearchParams({ player: playerParam, source: sourceFilter });
      if (mapFilter) p.set("map", mapFilter);
      if (modeFilter) p.set("mode", modeFilter);
      return fetch(`/api/brawler-stats?${p}`).then((r) => r.json());
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
    enabled: !!playerParam,
  });

  const brawlers = useMemo(() => {
    const b = data?.brawlers ?? [];
    return [...b].sort((a, c) => {
      if (sortBy === "picks") return c.picks - a.picks;
      if (sortBy === "wr") return c.winRate - a.winRate;
      if (sortBy === "presence") return c.presence - a.presence;
      return c.bans - a.bans;
    });
  }, [data, sortBy]);
  const allMaps = data?.allMaps ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}
          className="bg-card/40 border border-border/40 text-xs font-mono rounded-lg px-3 py-2 text-foreground focus:outline-none">
          <option value="">Alle Modi</option>
          {["bounty", "heist", "hotZone", "brawlBall", "gemGrab", "knockout"].map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select>
        <select value={mapFilter} onChange={(e) => setMapFilter(e.target.value)}
          className="bg-card/40 border border-border/40 text-xs font-mono rounded-lg px-3 py-2 text-foreground focus:outline-none">
          <option value="">Alle Maps</option>
          {allMaps.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex gap-0.5 bg-black/40 border border-border/40 rounded-lg p-0.5">
          {[["all", "All"], ["scrims", "Scrims"], ["matcherino", "Matcherino"]].map(([v, l]) => (
            <button key={v} onClick={() => setSourceFilter(v)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${sourceFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-0.5 bg-black/40 border border-border/40 rounded-lg p-0.5 ml-auto">
          {[["picks", "Picks"], ["wr", "WR%"], ["presence", "PR%"], ["bans", "Bans"]].map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v as any)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${sortBy === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] gap-0 text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/30">
          <span>Brawler</span><span className="text-center">Picks</span><span className="text-center">Bans</span><span className="text-center">PR%</span><span className="text-center">WR%</span><span />
        </div>
        <div className="divide-y divide-border/20">
          {brawlers.length === 0
            ? <div className="text-center py-10 text-muted-foreground text-sm font-mono">Keine Daten.</div>
            : brawlers.map((b) => {
              const isExpanded = expandedBrawler === b.name;
              const wrCol = b.winRate >= 60 ? "text-emerald-400" : b.winRate >= 50 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={b.name}>
                  <div
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] gap-0 items-center px-4 py-2.5 hover:bg-white/3 transition-colors cursor-pointer"
                    onClick={() => setExpandedBrawler(isExpanded ? null : b.name)}>
                    <div className="flex items-center gap-2">
                      <img src={getBrawlerImg(b.name)} alt={b.name}
                        className="w-7 h-7 rounded object-contain bg-black/40 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <span className="text-xs font-mono font-bold text-foreground capitalize">{b.name.toLowerCase()}</span>
                    </div>
                    <span className="text-xs font-mono text-center">{b.picks}</span>
                    <span className="text-xs font-mono text-center text-orange-400">{b.bans}</span>
                    <span className="text-xs font-mono text-center text-blue-400">{b.presence.toFixed(1)}%</span>
                    <span className={`text-xs font-black font-mono text-center ${wrCol}`}>{b.picks > 0 ? `${b.winRate}%` : "—"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  <AnimatePresence>
                    {isExpanded && <CustomBrawlerDetailPanel b={b} />}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════════
// ─── PLAYER PAGE ─────────────────────────────────────────────────────────────
// ─── ═══════════════════════════════════════════════════════════════════════════

function PlayerPageOverview({ stats, games }: { stats: TeamStats; games: UnifiedGame[] | undefined }) {
  const scrimSrc = stats.bySource.find((s) => s.source === "scrim");
  const mmSrc = stats.bySource.find((s) => s.source === "matcherino");

  // Recent form
  const recentForm = useMemo(() => {
    if (!games) return [];
    return [...games].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
  }, [games]);

  // Streak
  const streak = useMemo(() => {
    let s = 0;
    for (const g of recentForm) {
      if (s === 0) { s = g.result === "W" ? 1 : g.result === "L" ? -1 : 0; continue; }
      if (s > 0 && g.result === "W") s++; else if (s < 0 && g.result === "L") s--; else break;
    }
    return s;
  }, [recentForm]);

  // Mode radar data
  const modeRadar = useMemo(() => stats.byMode.map((m) => ({
    mode: MODE_LABEL[m.mode] ?? m.mode,
    wr: m.wr,
    games: m.games,
    fullMark: 100,
  })), [stats.byMode]);

  // Top brawlers for chart
  const topBrawlerChart = useMemo(() => {
    if (!stats.byBrawler) return [];
    return [...stats.byBrawler].sort((a, b) => b.picks - a.picks).slice(0, 12).map((b) => ({
      name: b.name.charAt(0).toUpperCase() + b.name.slice(1).toLowerCase(),
      picks: b.picks,
      wr: b.winRate,
      bans: b.bans,
    }));
  }, [stats.byBrawler]);

  return (
    <div className="space-y-6">
      {/* ── Hero Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Win Rate", value: `${stats.winRate}%`, color: stats.winRate >= 60 ? "text-emerald-400" : stats.winRate >= 50 ? "text-yellow-400" : "text-red-400" },
          { label: "Games", value: `${stats.total}`, color: "text-foreground/80" },
          { label: "Wins", value: `${stats.wins}`, color: "text-emerald-400" },
          { label: "Losses", value: `${stats.losses}`, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/30 border border-border/40 rounded-xl p-4 text-center">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Source Split ── */}
      {(scrimSrc || mmSrc) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { s: scrimSrc, label: "Scrims", color: "blue" },
            { s: mmSrc, label: "Matcherino", color: "yellow" },
          ].map(({ s, label, color }) => (
            <div key={label} className="bg-card/20 border border-border/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${color === "yellow" ? "text-yellow-400" : "text-blue-400"}`}>{label}</span>
                {s && s.games > 0 && <span className={`text-xl font-black font-mono ${s.wr >= 60 ? "text-emerald-400" : s.wr >= 50 ? "text-yellow-400" : "text-red-400"}`}>{s.wr}%</span>}
              </div>
              {!s || s.games === 0
                ? <p className="text-xs font-mono text-muted-foreground/40">Keine Daten</p>
                : <>
                  <div className="flex gap-4 mb-2">
                    <div className="text-center"><div className="text-lg font-black font-mono text-emerald-400">{s.wins}</div><div className="text-[9px] text-muted-foreground font-mono">W</div></div>
                    <div className="text-center"><div className="text-lg font-black font-mono text-red-400">{s.losses}</div><div className="text-[9px] text-muted-foreground font-mono">L</div></div>
                    <div className="text-center"><div className="text-lg font-black font-mono text-white/60">{s.games}</div><div className="text-[9px] text-muted-foreground font-mono">Total</div></div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color === "yellow" ? "bg-yellow-500/60" : "bg-blue-500/60"}`} style={{ width: `${s.wr}%` }} />
                  </div>
                </>}
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Form ── */}
      {recentForm.length > 0 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-orange-400" /> Letzte {recentForm.length} Spiele
            </div>
            {streak !== 0 && (
              <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${streak > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {streak > 0 ? `🔥 ${streak}W` : `❄️ ${Math.abs(streak)}L`} Streak
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {recentForm.map((g, i) => (
              <div key={i} title={`vs ${g.opponentName} · ${g.map} · ${g.source} · ${formatDate(g.time)}`}
                className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black font-mono border cursor-default transition-all hover:scale-110 ${g.result === "W" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : g.result === "L" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>
                {g.result === "W" ? "W" : g.result === "L" ? "L" : "—"}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/40 ${g.source === "matcherino" ? "bg-violet-400" : "bg-blue-400"}`} />
              </div>
            ))}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/50 mt-2 flex items-center gap-3">
            <span>Hover für Details · Neueste links</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Scrim</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Matcherino</span>
          </div>
        </div>
      )}

      {/* ── Mode Radar Chart ── */}
      {modeRadar.length >= 3 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> Win Rate nach Modus
          </div>
          <div className="flex gap-6 items-center">
            <ResponsiveContainer width="50%" height={200}>
              <RadarChart data={modeRadar} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                <PolarGrid stroke="#ffffff10" />
                <PolarAngleAxis dataKey="mode" tick={{ fill: "#888", fontSize: 9 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="WR" dataKey="wr" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl"><p className="text-white/60">{d.mode}</p><p className="text-emerald-400 font-bold">{d.wr}% WR</p><p className="text-white/40">{d.games} Spiele</p></div>;
                }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {stats.byMode.sort((a, b) => b.games - a.games).map((m) => (
                <div key={m.mode} className="flex items-center gap-2">
                  <span className="text-sm">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">{MODE_LABEL[m.mode] ?? m.mode}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.wr}%`, background: m.wr >= 60 ? "#22c55e" : m.wr >= 50 ? "#eab308" : "#ef4444" }} />
                  </div>
                  <WrBadge wr={m.wr} games={m.games} />
                  <span className="text-[9px] text-muted-foreground font-mono w-10 text-right">{m.games}g</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Brawlers Bar Chart ── */}
      {topBrawlerChart.length > 0 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-yellow-400" /> Top Brawlers (nach Picks)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={topBrawlerChart} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 8 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: "#666", fontSize: 9 }} width={24} />
              <Tooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={getBrawlerImg(d.name)} className="w-5 h-5 rounded" alt={d.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-white font-bold capitalize">{d.name}</span>
                  </div>
                  <p className="text-blue-400">{d.picks} Picks</p>
                  <p className={d.wr >= 60 ? "text-emerald-400" : d.wr >= 50 ? "text-yellow-400" : "text-red-400"}>{d.wr}% WR</p>
                </div>;
              }} />
              <Bar dataKey="picks" radius={[3, 3, 0, 0]}>
                {topBrawlerChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Timeline ── */}
      {stats.timeline.length >= 2 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Win Rate Trend (wöchentlich)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 9 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={30} />
              <ReferenceLine y={50} stroke="#ffffff18" strokeDasharray="4 4" />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl"><p className="text-white/60 mb-1">KW {label}</p><p className="text-emerald-400 font-bold">{d.wr}% WR</p><p className="text-white/40">{d.wins}W / {d.games - d.wins}L ({d.games} Spiele)</p></div>;
              }} />
              <Line type="monotone" dataKey="wr" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PlayerPageMaps({ stats, playerParam }: { stats: TeamStats; playerParam: string }) {
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const { data: mapBrawlerData, isLoading: mapLoading } = useQuery<BrawlerStatsResponse>({
    queryKey: ["/api/brawler-stats", "playermap", playerParam, selectedMap],
    queryFn: () => {
      const p = new URLSearchParams({ player: playerParam, source: "all" });
      if (selectedMap) p.set("map", selectedMap);
      return fetch(`/api/brawler-stats?${p}`).then((r) => r.json());
    },
    enabled: !!selectedMap && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  if (selectedMap) {
    const brawlers = (mapBrawlerData?.brawlers ?? []).filter((b) => b.picks > 0);
    const mapEntry = stats.byMap.find((m) => m.map === selectedMap);
    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedMap(null)} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Alle Maps
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">{MAP_EMOJI[selectedMap] ?? "🗺️"}</span>
          <span className="font-black font-mono text-xl text-foreground">{selectedMap}</span>
          {mapEntry && (
            <div className="ml-auto flex items-center gap-4 text-sm font-mono">
              <span className="text-emerald-400 font-bold">{mapEntry.wins}W</span>
              <span className="text-red-400 font-bold">{mapEntry.losses}L</span>
              <WrBadge wr={mapEntry.wr} games={mapEntry.games} size="lg" />
            </div>
          )}
        </div>
        {mapLoading ? <div className="h-40 rounded-xl bg-card/20 animate-pulse" />
          : brawlers.length === 0
            ? <div className="text-center py-12 border border-dashed border-border/40 rounded-xl text-muted-foreground text-sm font-mono">Keine Brawler-Daten.</div>
            : (
              <>
                <div className="bg-card/20 border border-border/40 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">Top Picks auf {selectedMap}</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={brawlers.slice(0, 12).map(b => ({ name: b.name.toLowerCase(), picks: b.picks, wr: b.winRate }))} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 8 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#666", fontSize: 9 }} width={24} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                          <div className="flex items-center gap-2 mb-1"><img src={getBrawlerImg(d.name)} className="w-5 h-5 rounded" alt={d.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /><span className="text-white font-bold">{d.name}</span></div>
                          <p className="text-blue-400">{d.picks} Picks</p><p className={d.wr >= 60 ? "text-emerald-400" : "text-red-400"}>{d.wr}% WR</p>
                        </div>;
                      }} />
                      <Bar dataKey="picks" radius={[3, 3, 0, 0]}>
                        {brawlers.slice(0, 12).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/30">
                    <span>Brawler</span><span className="text-center">Picks</span><span className="text-center">W / L</span><span className="text-center">WR%</span>
                  </div>
                  <div className="divide-y divide-border/20 max-h-80 overflow-y-auto">
                    {brawlers.filter(b => b.picks >= 1).sort((a, b) => b.picks - a.picks).map((b) => (
                      <div key={b.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-2.5 hover:bg-white/3 transition-colors">
                        <div className="flex items-center gap-2">
                          <img src={getBrawlerImg(b.name)} alt={b.name} className="w-6 h-6 rounded object-contain bg-black/40 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span className="text-xs font-mono font-bold capitalize">{b.name.toLowerCase()}</span>
                        </div>
                        <span className="text-xs font-mono text-center">{b.picks}</span>
                        <span className="text-xs font-mono text-center">{b.wins}W {b.losses}L</span>
                        <WrBadge wr={b.winRate} games={b.picks} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
      </div>
    );
  }

  const maxGames = Math.max(...stats.byMap.map((m) => m.games), 1);

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Klick auf eine Map für Brawler-Analyse</p>
      <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_90px_60px] gap-2 px-4 py-2 border-b border-border/30 text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
          <span>Map</span><span className="text-center">Spiele</span><span className="text-center">W / L</span><span className="text-center">WR</span>
        </div>
        <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
          {stats.byMap.map((m) => (
            <div key={m.map} onClick={() => setSelectedMap(m.map)}
              className="grid grid-cols-[1fr_70px_90px_60px] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors group">
              <div>
                <div className="text-xs font-mono font-bold flex items-center gap-1.5 group-hover:text-primary transition-colors">
                  <span className="text-base">{MAP_EMOJI[m.map] ?? "🗺️"}</span>
                  {m.map}
                  <ChevronRight className="w-3 h-3 text-primary/0 group-hover:text-primary/60 transition-colors ml-auto" />
                </div>
                <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(m.games / maxGames) * 100}%`, background: `linear-gradient(to right, #22c55e ${m.wr}%, #ef4444 ${m.wr}%)` }} />
                </div>
              </div>
              <span className="text-xs font-mono text-center text-foreground/70">{m.games}</span>
              <span className="text-xs font-mono text-center text-foreground/60">{m.wins}W {m.losses}L</span>
              <WrBadge wr={m.wr} games={m.games} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerPageAnalytics({ stats, games, playerParam }: { stats: TeamStats; games: UnifiedGame[] | undefined; playerParam: string }) {
  const [section, setSection] = useState<"opponents" | "teammates" | "brawlerwr" | "timeline">("brawlerwr");

  // Compute teammates from games (all players who appeared alongside this player)
  const teammates = useMemo(() => {
    if (!games) return [];
    const counts: Record<string, { games: number; wins: number }> = {};
    const playerNames = playerParam.split(",").map((p) => p.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""));
    for (const g of games) {
      for (const p of g.myPlayers) {
        const n = (p.name ?? "").toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
        if (playerNames.includes(n)) continue;
        if (!counts[n]) counts[n] = { games: 0, wins: 0 };
        counts[n].games++;
        if (g.result === "W") counts[n].wins++;
      }
    }
    return Object.entries(counts)
      .map(([name, s]) => ({ name, games: s.games, wins: s.wins, wr: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0 }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 20);
  }, [games, playerParam]);

  // Brawler WR bar chart
  const brawlerWrData = useMemo(() => {
    return [...(stats.byBrawler ?? [])].filter((b) => b.picks >= 2).sort((a, b) => b.winRate - a.winRate).slice(0, 15).map((b) => ({
      name: b.name.toLowerCase(),
      wr: b.winRate,
      picks: b.picks,
    }));
  }, [stats.byBrawler]);

  const SECTIONS = [
    { key: "brawlerwr" as const, label: "Brawler WR", icon: <Star className="w-3 h-3" /> },
    { key: "timeline" as const, label: "Trend", icon: <TrendingUp className="w-3 h-3" /> },
    { key: "teammates" as const, label: "Teammates", icon: <Users className="w-3 h-3" /> },
    { key: "opponents" as const, label: "Gegner", icon: <Swords className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-5">
      <SectionNav sections={SECTIONS} active={section} onChange={setSection} />

      {section === "brawlerwr" && (
        <div className="space-y-4">
          <div className="bg-card/20 border border-border/40 rounded-xl p-4">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4">Brawler Win Rate (min. 2 Picks)</div>
            {brawlerWrData.length === 0
              ? <div className="text-center py-8 text-muted-foreground text-xs font-mono">Nicht genug Daten</div>
              : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={brawlerWrData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 70 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#aaa", fontSize: 9 }} width={65} />
                  <ReferenceLine x={50} stroke="#ffffff20" strokeDasharray="4 4" />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                      <div className="flex items-center gap-2 mb-1"><img src={getBrawlerImg(d.name)} className="w-5 h-5 rounded" alt={d.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /><span className="text-white">{d.name}</span></div>
                      <p className={d.wr >= 60 ? "text-emerald-400 font-bold" : d.wr >= 50 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>{d.wr}% WR</p>
                      <p className="text-white/40">{d.picks} Picks</p>
                    </div>;
                  }} />
                  <Bar dataKey="wr" radius={[0, 3, 3, 0]}>
                    {brawlerWrData.map((b, i) => <Cell key={i} fill={b.wr >= 60 ? "#22c55e" : b.wr >= 50 ? "#eab308" : "#ef4444"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>}
          </div>
        </div>
      )}

      {section === "timeline" && (
        <div className="space-y-4">
          <div className="bg-card/20 border border-border/40 rounded-xl p-4">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4">Wöchentliche Win Rate (Scrims + Matcherino)</div>
            {stats.timeline.length < 2
              ? <div className="text-center py-8 text-muted-foreground text-xs font-mono">Nicht genug Daten</div>
              : <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={30} />
                  <ReferenceLine y={50} stroke="#ffffff18" strokeDasharray="4 4" />
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl"><p className="text-white/60 mb-1">KW {label}</p><p className="text-emerald-400 font-bold">{d.wr}% WR</p><p className="text-white/40">{d.wins}W / {d.games - d.wins}L ({d.games} Spiele)</p></div>;
                  }} />
                  <Line type="monotone" dataKey="wr" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.byMode.map((m) => (
              <div key={m.mode} className="bg-card/20 border border-border/40 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                  <span className="text-[10px] font-mono text-white/60">{MODE_LABEL[m.mode]}</span>
                </div>
                <div className="flex items-end justify-between mb-1.5">
                  <WrBadge wr={m.wr} games={m.games} size="lg" />
                  <span className="text-[10px] font-mono text-white/30">{m.games}g</span>
                </div>
                <WrBar wr={m.wr} wins={m.wins} losses={m.losses} />
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "teammates" && (
        <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Häufigste Teammates</div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/20">
            <span>Spieler</span><span className="text-center">Spiele</span><span className="text-center">W / L</span><span className="text-center">WR%</span>
          </div>
          <div className="divide-y divide-border/20 max-h-[400px] overflow-y-auto">
            {teammates.length === 0
              ? <div className="text-center py-10 text-muted-foreground text-xs font-mono">Keine Daten</div>
              : teammates.map((t) => (
                <div key={t.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-2.5 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-primary/60" />
                    </div>
                    <span className="text-xs font-mono font-bold truncate">{t.name}</span>
                  </div>
                  <span className="text-xs font-mono text-center">{t.games}</span>
                  <span className="text-xs font-mono text-center text-foreground/60">{t.wins}W {t.games - t.wins}L</span>
                  <WrBadge wr={t.wr} games={t.games} />
                </div>
              ))}
          </div>
        </div>
      )}

      {section === "opponents" && (
        <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Häufigste Gegner</div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/20">
            <span>Gegner</span><span className="text-center">Spiele</span><span className="text-center">W / L</span><span className="text-center">WR%</span>
          </div>
          <div className="divide-y divide-border/20 max-h-[400px] overflow-y-auto">
            {stats.byOpponent.length === 0
              ? <div className="text-center py-10 text-muted-foreground text-xs font-mono">Keine Daten</div>
              : stats.byOpponent.slice(0, 30).map((o) => (
                <div key={o.code} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-2.5 hover:bg-white/3 transition-colors">
                  <span className="text-xs font-mono font-bold truncate">{o.name}</span>
                  <span className="text-xs font-mono text-center">{o.games}</span>
                  <span className="text-xs font-mono text-center text-foreground/60">{o.wins}W {o.losses}L</span>
                  <WrBadge wr={o.wr} games={o.games} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════════
// ─── TEAM PAGE TABS ───────────────────────────────────────────────────────────
// ─── ═══════════════════════════════════════════════════════════════════════════

function TeamOverviewTab({ stats, games }: { stats: TeamStats; games: UnifiedGame[] | undefined }) {
  const scrimSrc = stats.bySource.find((s) => s.source === "scrim");
  const mmSrc = stats.bySource.find((s) => s.source === "matcherino");

  const recentForm = useMemo(() => {
    if (!games) return [];
    return [...games].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15);
  }, [games]);

  const streak = useMemo(() => {
    let s = 0;
    for (const g of recentForm) {
      if (s === 0) { s = g.result === "W" ? 1 : g.result === "L" ? -1 : 0; continue; }
      if (s > 0 && g.result === "W") s++; else if (s < 0 && g.result === "L") s--; else break;
    }
    return s;
  }, [recentForm]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Win Rate", value: `${stats.winRate}%`, color: stats.winRate >= 60 ? "text-emerald-400" : stats.winRate >= 50 ? "text-yellow-400" : "text-red-400" },
          { label: "Games", value: `${stats.total}`, color: "text-foreground/80" },
          { label: "Wins", value: `${stats.wins}`, color: "text-emerald-400" },
          { label: "Losses", value: `${stats.losses}`, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/30 border border-border/40 rounded-xl p-4 text-center">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {stats.total === 0 && (
        <div className="bg-card/20 border border-dashed border-border/40 rounded-xl p-4 flex items-center gap-3">
          <Swords className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          <p className="text-xs font-mono text-muted-foreground/60">Keine Spiele in der Datenbank gefunden.</p>
        </div>
      )}

      {/* Source breakdown */}
      {(scrimSrc || mmSrc) && (
        <div className="grid grid-cols-2 gap-3">
          {[{ s: scrimSrc, label: "Scrims", color: "blue" }, { s: mmSrc, label: "Matcherino", color: "yellow" }].map(({ s, label, color }) => (
            <div key={label} className="bg-card/20 border border-border/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono uppercase font-bold ${color === "yellow" ? "text-yellow-400" : "text-blue-400"}`}>{label}</span>
                {s && s.games > 0 && <span className={`text-xl font-black font-mono ${s.wr >= 60 ? "text-emerald-400" : s.wr >= 50 ? "text-yellow-400" : "text-red-400"}`}>{s.wr}%</span>}
              </div>
              {!s || s.games === 0 ? <p className="text-xs text-muted-foreground/40 font-mono">Keine Daten</p>
                : <>
                  <div className="flex gap-4 mb-2">
                    <div className="text-center"><div className="text-lg font-black font-mono text-emerald-400">{s.wins}</div><div className="text-[9px] text-muted-foreground font-mono">W</div></div>
                    <div className="text-center"><div className="text-lg font-black font-mono text-red-400">{s.losses}</div><div className="text-[9px] text-muted-foreground font-mono">L</div></div>
                    <div className="text-center"><div className="text-lg font-black font-mono text-white/60">{s.games}</div><div className="text-[9px] text-muted-foreground font-mono">Total</div></div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color === "yellow" ? "bg-yellow-500/60" : "bg-blue-500/60"}`} style={{ width: `${s.wr}%` }} /></div>
                </>}
            </div>
          ))}
        </div>
      )}

      {/* Recent form */}
      {recentForm.length > 0 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-orange-400" /> Letzte {recentForm.length} Spiele</div>
            {streak !== 0 && <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${streak > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{streak > 0 ? `🔥 ${streak}W` : `❄️ ${Math.abs(streak)}L`} Streak</div>}
          </div>
          <div className="flex gap-1 flex-wrap">
            {recentForm.map((g, i) => (
              <div key={i} title={`vs ${g.opponentName} · ${g.map} · ${g.source} · ${formatDate(g.time)}`}
                className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black font-mono border cursor-default hover:scale-110 transition-transform ${g.result === "W" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : g.result === "L" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>
                {g.result === "W" ? "W" : g.result === "L" ? "L" : "—"}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/40 ${g.source === "matcherino" ? "bg-violet-400" : "bg-blue-400"}`} />
              </div>
            ))}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/50 mt-2 flex items-center gap-3">
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1" />Scrim</span>
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1" />Matcherino</span>
          </div>
        </div>
      )}

      {/* Mode bars */}
      {stats.byMode.length > 0 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">By Game Mode</div>
          <div className="space-y-2.5">
            {stats.byMode.sort((a, b) => b.games - a.games).map((m) => (
              <div key={m.mode} className="flex items-center gap-2">
                <span className="text-base">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                <span className="text-xs font-mono text-foreground/80 w-20">{MODE_LABEL[m.mode] ?? m.mode}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.wr}%`, background: `linear-gradient(to right, #22c55e ${m.wr}%, #ef4444 ${m.wr}%)` }} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-16 text-right">{m.wins}W {m.losses}L</span>
                <WrBadge wr={m.wr} games={m.games} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opponents */}
      {stats.byOpponent.length > 0 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Häufigste Gegner</div>
          <div className="divide-y divide-border/20">
            {stats.byOpponent.slice(0, 8).map((o) => (
              <div key={o.code} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-mono font-bold">{o.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">{o.wins}W {o.losses}L</span>
                  <WrBadge wr={o.wr} games={o.games} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {stats.timeline.length >= 2 && (
        <div className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Win Rate Trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={stats.timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 9 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={30} />
              <ReferenceLine y={50} stroke="#ffffff18" strokeDasharray="4 4" />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl"><p className="text-white/60">KW {label}</p><p className="text-emerald-400 font-bold">{d.wr}% WR</p><p className="text-white/40">{d.wins}W / {d.games - d.wins}L</p></div>;
              }} />
              <Line type="monotone" dataKey="wr" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TeamPlayersTab({ stats }: { stats: TeamStats | undefined }) {
  if (!stats) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;
  if (stats.players.length === 0) return (
    <div className="text-center py-16 border border-dashed border-border/40 rounded-xl">
      <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-muted-foreground text-sm font-mono">Keine Spieler-Daten verfügbar.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {stats.players.sort((a, b) => b.games - a.games).map((p) => (
        <div key={p.name} className="bg-card/20 border border-border/40 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="font-black font-mono text-lg">{stripPrefix(p.name)}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5">{p.games} Spiele</div>
            </div>
            <div className="text-right">
              <WrBadge wr={p.winRate} games={p.games} size="lg" />
              <div className="text-[9px] font-mono text-muted-foreground">{p.wins}W {p.games - p.wins}L</div>
            </div>
          </div>
          <WrBar wr={p.winRate} wins={p.wins} losses={p.games - p.wins} />
          {p.topBrawlers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.topBrawlers.slice(0, 8).map(({ brawler, count }) => (
                <BrawlerChip key={brawler} name={brawler} count={count} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamAnalyticsTab({ stats, scrims, games, playerParam }: { stats: TeamStats; scrims: Scrim[] | undefined; games: UnifiedGame[] | undefined; playerParam: string }) {
  const [section, setSection] = useState<"maps" | "trends" | "brawlers" | "combos">("maps");
  const [view, setView] = useState<"map" | "opponent">("map");
  const [selectedMap, setSelectedMap] = useState<string | null>(null);

  const { data: mapBrawlerData, isLoading: mapLoading } = useQuery<BrawlerStatsResponse>({
    queryKey: ["/api/brawler-stats", "team-analytics-map", playerParam, selectedMap],
    queryFn: () => {
      const p = new URLSearchParams({ player: playerParam, source: "all" });
      if (selectedMap) p.set("map", selectedMap);
      return fetch(`/api/brawler-stats?${p}`).then((r) => r.json());
    },
    enabled: !!selectedMap && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  const recentForm = useMemo(() => {
    if (!games) return [];
    return [...games].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15).map((g) => ({ won: g.result === "W", lost: g.result === "L", map: g.map, mode: g.mode, opp: g.opponentName, time: g.time, source: g.source }));
  }, [games]);

  const brawlerCombos = useMemo(() => {
    if (!scrims) return [];
    const pairs: Record<string, { games: number; wins: number }> = {};
    for (const s of scrims) {
      const myPlayers = (s.customSide === "team1" ? s.team1Players : s.team2Players) ?? [];
      const won = s.customWon;
      const brawlers = myPlayers.map((p: any) => p.brawler?.toUpperCase()).filter((b: any): b is string => !!b);
      for (let i = 0; i < brawlers.length; i++) {
        for (let j = i + 1; j < brawlers.length; j++) {
          const key = [brawlers[i], brawlers[j]].sort().join(" + ");
          if (!pairs[key]) pairs[key] = { games: 0, wins: 0 };
          pairs[key].games++;
          if (won) pairs[key].wins++;
        }
      }
    }
    return Object.entries(pairs).map(([pair, s]) => ({ pair, games: s.games, wins: s.wins, losses: s.games - s.wins, wr: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0 })).filter((c) => c.games >= 3).sort((a, b) => b.games - a.games).slice(0, 20);
  }, [scrims]);

  const SECTIONS = [
    { key: "maps" as const, label: "Maps", icon: <Map className="w-3 h-3" /> },
    { key: "trends" as const, label: "Trends", icon: <TrendingUp className="w-3 h-3" /> },
    { key: "brawlers" as const, label: "Brawlers", icon: <Star className="w-3 h-3" /> },
    { key: "combos" as const, label: "Combos", icon: <Zap className="w-3 h-3" /> },
  ];

  if (selectedMap && section === "maps") {
    const brawlers = mapBrawlerData?.brawlers ?? [];
    const mapEntry = stats.byMap.find((m) => m.map === selectedMap);
    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedMap(null)} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Zurück</button>
        <div className="flex items-center gap-3"><span className="text-2xl">{MAP_EMOJI[selectedMap] ?? "🗺️"}</span><span className="font-black font-mono text-lg">{selectedMap}</span>{mapEntry && <div className="ml-auto flex items-center gap-4 font-mono text-sm"><span className="text-emerald-400">{mapEntry.wins}W</span><span className="text-red-400">{mapEntry.losses}L</span><WrBadge wr={mapEntry.wr} games={mapEntry.games} size="lg" /></div>}</div>
        {mapLoading ? <div className="h-40 rounded-xl bg-card/20 animate-pulse" />
          : brawlers.length === 0 ? <div className="text-center py-12 border border-dashed border-border/40 rounded-xl text-muted-foreground text-sm font-mono">Keine Brawler-Daten.</div>
            : <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/20"><span>Brawler</span><span className="text-center">Picks</span><span className="text-center">W / L</span><span className="text-center">WR%</span></div>
              <div className="divide-y divide-border/20 max-h-80 overflow-y-auto">
                {brawlers.filter(b => b.picks >= 1).sort((a, b) => b.picks - a.picks).map((b) => (
                  <div key={b.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-2.5 hover:bg-white/3 transition-colors">
                    <div className="flex items-center gap-2"><img src={getBrawlerImg(b.name)} alt={b.name} className="w-6 h-6 rounded object-contain bg-black/40 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /><span className="text-xs font-mono font-bold capitalize">{b.name.toLowerCase()}</span></div>
                    <span className="text-xs font-mono text-center">{b.picks}</span><span className="text-xs font-mono text-center">{b.wins}W {b.losses}L</span><WrBadge wr={b.winRate} games={b.picks} />
                  </div>
                ))}
              </div>
            </div>}
      </div>
    );
  }

  const data = view === "map" ? stats.byMap : stats.byOpponent;
  const maxGames = Math.max(...data.map((d) => d.games), 1);

  return (
    <div className="space-y-5">
      <SectionNav sections={SECTIONS} active={section} onChange={setSection} />

      {section === "maps" && (
        <>
          <div className="flex gap-2">
            {(["map", "opponent"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest border transition-all ${view === v ? "bg-primary/20 border-primary/40 text-primary" : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground"}`}>{v === "map" ? "Maps" : "Gegner"}</button>
            ))}
          </div>
          {view === "map" && <p className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Klick auf eine Map für Brawler-Analyse</p>}
          <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-4 py-2 border-b border-border/30 text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
              <span>{view === "map" ? "Map" : "Gegner"}</span><span className="text-center">Spiele</span><span className="text-center">W / L</span><span className="text-center">WR</span>
            </div>
            <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
              {data.slice(0, 40).map((d: any) => (
                <div key={d.map ?? d.code} onClick={() => view === "map" && d.map && setSelectedMap(d.map)}
                  className={`grid grid-cols-[1fr_80px_80px_60px] gap-2 items-center px-4 py-3 transition-colors ${view === "map" ? "cursor-pointer hover:bg-white/5 group" : ""}`}>
                  <div>
                    <div className="text-xs font-mono font-bold flex items-center gap-1.5">
                      {view === "map" && <span className="text-base">{MAP_EMOJI[d.map] ?? "🗺️"}</span>}
                      <span className={view === "map" ? "group-hover:text-primary transition-colors" : ""}>{d.map ?? d.name ?? d.code}</span>
                      {view === "map" && <ChevronRight className="w-3 h-3 text-primary/0 group-hover:text-primary/60 transition-colors ml-auto" />}
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(d.games / maxGames) * 100}%`, background: `linear-gradient(to right, #22c55e ${d.wr}%, #ef4444 ${d.wr}%)` }} /></div>
                  </div>
                  <span className="text-xs font-mono text-center">{d.games}</span>
                  <span className="text-xs font-mono text-center text-foreground/70">{d.wins}W {d.losses}L</span>
                  <WrBadge wr={d.wr} games={d.games} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {section === "trends" && (
        <>
          <div className="bg-card/20 border border-border/40 rounded-xl p-4">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-orange-400" /> Letzte {recentForm.length} Spiele</div>
            <div className="flex gap-1 flex-wrap">
              {recentForm.map((g, i) => (
                <div key={i} title={`vs ${g.opp} · ${g.map} · ${g.source} · ${formatDate(g.time)}`}
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black font-mono border cursor-default hover:scale-110 transition-transform ${g.won ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : g.lost ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>
                  {g.won ? "W" : g.lost ? "L" : "—"}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/40 ${g.source === "matcherino" ? "bg-violet-400" : "bg-blue-400"}`} />
                </div>
              ))}
            </div>
          </div>
          {stats.timeline.length >= 2 && (
            <div className="bg-card/20 border border-border/40 rounded-xl p-4">
              <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Wöchentliche Win Rate</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats.timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={30} />
                  <ReferenceLine y={50} stroke="#ffffff18" strokeDasharray="4 4" />
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl"><p className="text-white/60">KW {label}</p><p className="text-emerald-400 font-bold">{d.wr}% WR</p><p className="text-white/40">{d.wins}W / {d.games - d.wins}L ({d.games} Spiele)</p></div>;
                  }} />
                  <Line type="monotone" dataKey="wr" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.byMode.map((m) => (
              <div key={m.mode} className="bg-card/20 border border-border/40 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2"><span className="text-lg">{MODE_ICONS[m.mode] ?? "🎮"}</span><span className="text-[10px] font-mono text-white/60">{MODE_LABEL[m.mode]}</span></div>
                <WrBadge wr={m.wr} games={m.games} size="lg" />
                <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{m.games} Spiele</div>
                <WrBar wr={m.wr} wins={m.wins} losses={m.losses} />
              </div>
            ))}
          </div>
        </>
      )}

      {section === "brawlers" && <BrawlerTable playerParam={playerParam} />}

      {section === "combos" && (
        <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-400" /><span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Top Brawler-Kombinationen (min. 3 Spiele)</span></div>
          {brawlerCombos.length === 0 ? <div className="text-center py-12 text-muted-foreground text-xs font-mono">Nicht genug Daten</div>
            : <>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-4 py-2 border-b border-border/20"><span>Kombination</span><span className="text-center">Spiele</span><span className="text-center">W / L</span><span className="text-center">WR%</span></div>
              <div className="divide-y divide-border/20 max-h-[480px] overflow-y-auto">
                {brawlerCombos.map((c, i) => {
                  const [b1, b2] = c.pair.split(" + ");
                  const maxG = brawlerCombos[0]?.games ?? 1;
                  return (
                    <div key={c.pair} className="px-4 py-2.5 hover:bg-white/3 transition-colors">
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-white/20 w-3">{i + 1}</span>
                          <div className="flex items-center gap-1">
                            {[b1, b2].map((b) => <img key={b} src={getBrawlerImg(b)} alt={b} className="w-6 h-6 rounded-full bg-black/40 object-cover border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />)}
                          </div>
                          <span className="text-[10px] font-mono text-foreground/80 capitalize truncate">{b1.toLowerCase()} + {b2.toLowerCase()}</span>
                        </div>
                        <span className="text-xs font-mono text-center">{c.games}</span>
                        <span className="text-xs font-mono text-center text-foreground/60">{c.wins}W {c.losses}L</span>
                        <WrBadge wr={c.wr} games={c.games} />
                      </div>
                      <div className="mt-1.5 ml-12 h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.games / maxG) * 100}%`, background: c.wr >= 60 ? "#22c55e" : c.wr >= 50 ? "#eab308" : "#ef4444" }} /></div>
                    </div>
                  );
                })}
              </div>
            </>}
        </div>
      )}
    </div>
  );
}

// Matches tab (Matcherino BO3/BO5 + scrims)
function TeamMatchesTab({ matches, scrims, players }: { matches: MatchEntry[] | undefined; scrims: Scrim[] | undefined; players: string[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "scrim" | "matcherino">("all");
  const [selectedRounds, setSelectedRounds] = useState<string[]>([]);
  const [roundsOpen, setRoundsOpen] = useState(false);

  const allRounds = useMemo(() => [...new Set((matches ?? []).map((m) => m.roundName).filter((r): r is string => !!r))].sort(), [matches]);

  const items = useMemo(() => {
    type Item = { kind: "match"; data: MatchEntry; time: number } | { kind: "scrim"; data: Scrim; time: number };
    const result: Item[] = [];
    if (sourceFilter !== "scrim") {
      for (const m of matches ?? []) {
        if (selectedRounds.length > 0 && !selectedRounds.includes(m.roundName ?? "")) continue;
        result.push({ kind: "match", data: m, time: new Date(m.createdAt).getTime() });
      }
    }
    if (sourceFilter !== "matcherino") {
      for (const s of scrims ?? []) result.push({ kind: "scrim", data: s, time: new Date(s.time).getTime() });
    }
    return result.sort((a, b) => b.time - a.time);
  }, [matches, scrims, sourceFilter, selectedRounds]);

  if (!matches) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;

  const toggleRound = (r: string) => setSelectedRounds((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 bg-black/40 border border-border/40 rounded-lg p-0.5">
          {([["all", "All"], ["scrim", "Scrim"], ["matcherino", "Matcherino"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setSourceFilter(v); if (v !== "matcherino") setSelectedRounds([]); }}
              className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${sourceFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        {sourceFilter === "matcherino" && allRounds.length > 0 && (
          <div className="relative">
            <button onClick={() => setRoundsOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase transition-colors ${selectedRounds.length > 0 ? "bg-primary/20 border-primary/40 text-primary" : "bg-black/40 border-border/40 text-muted-foreground hover:text-foreground"}`}>
              <Filter className="w-3 h-3" /> Runden {selectedRounds.length > 0 && `(${selectedRounds.length})`}<ChevronDown className={`w-3 h-3 transition-transform ${roundsOpen ? "rotate-180" : ""}`} />
            </button>
            {roundsOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-card/95 border border-border/60 rounded-xl shadow-2xl backdrop-blur-md p-2 min-w-[180px]">
                {allRounds.map((r) => (
                  <button key={r} onClick={() => toggleRound(r)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors text-left ${selectedRounds.includes(r) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[8px] ${selectedRounds.includes(r) ? "border-primary bg-primary/30 text-primary" : "border-white/20"}`}>{selectedRounds.includes(r) && "✓"}</span>
                    {r}
                  </button>
                ))}
                {selectedRounds.length > 0 && <button onClick={() => setSelectedRounds([])} className="w-full text-center text-[9px] font-mono text-red-400 mt-1 py-1 hover:bg-red-500/10 rounded transition-colors">Zurücksetzen</button>}
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{items.length} Games</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-xl">
          <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm font-mono">Keine Spiele gefunden.</p>
        </div>
      ) : items.map((item) => {
        if (item.kind === "scrim") {
          const s = item.data;
          const pNames = players.map((n) => n.toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""));
          const t1Names = (s.team1Players ?? []).map((p: any) => (p.name ?? "").toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""));
          const isT1 = t1Names.some((n: string) => pNames.includes(n));
          const won = s.winnerTeamCode === (isT1 ? s.team1Code : s.team2Code);
          const lost = s.winnerTeamCode !== null && !won;
          const oppName = (isT1 ? s.team2Name : s.team1Name) ?? (isT1 ? s.team2Code : s.team1Code) ?? "?";
          const myName = (isT1 ? s.team1Name : s.team2Name) ?? "Custom Team";
          const myPlayers = (isT1 ? s.team1Players : s.team2Players) ?? [];
          const oppPlayers = (isT1 ? s.team2Players : s.team1Players) ?? [];
          const itemId = `scrim-${s.id}`;
          const isOpen = expandedId === itemId;
          return (
            <motion.div key={itemId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`bg-card/20 border rounded-xl overflow-hidden ${isOpen ? "border-blue-500/30" : "border-border/30"}`}>
              <div onClick={() => setExpandedId(isOpen ? null : itemId)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/3 transition-colors select-none">
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black font-mono ${won ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : lost ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-white/40 border border-white/10"}`}>{won ? "W" : lost ? "L" : "—"}</div>
                <span className="text-lg">{MODE_ICONS[s.mode] ?? "🎮"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black font-mono truncate">vs {oppName}</span>
                    <SourceBadge source="scrim" />
                    {s.isTournament && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">Tournament</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{s.map} · {MODE_LABEL[s.mode] ?? s.mode}</div>
                  {!isOpen && myPlayers.length > 0 && <div className="flex gap-0.5 mt-1">{myPlayers.map((p: any, i: number) => <img key={i} src={p.brawlerId ? getBrawlerImgById(p.brawlerId) : getBrawlerImg(p.brawler)} alt={p.brawler} className="w-4 h-4 rounded-full bg-black/40 object-cover border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />)}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">{s.scoreline && <div className="text-xs font-black font-mono">{s.scoreline}</div>}<div className="text-[9px] text-muted-foreground font-mono">{formatDate(s.time)}</div></div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </div>
              <AnimatePresence>
                {isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                  <div className="border-t border-border/30 bg-black/25 px-3 pb-3 pt-2.5">
                    <div className="flex items-center gap-2 mb-2.5"><span className="text-xl">{MAP_EMOJI[s.map] ?? "🗺️"}</span><div><div className="text-xs font-bold font-mono">{s.map}</div><div className="text-[9px] font-mono text-muted-foreground">{MODE_LABEL[s.mode]} · {formatDate(s.time)}</div></div>{s.scoreline && <div className="ml-auto font-black font-mono text-lg">{s.scoreline}</div>}</div>
                    <ScrimDraftGrid myPlayers={myPlayers} oppPlayers={oppPlayers} myName={myName} oppName={oppName} won={won} />
                    {s.mvpPlayer && <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-mono text-yellow-400/80"><Star className="w-3 h-3" /> MVP: <span className="font-bold">{s.mvpPlayer}</span></div>}
                  </div>
                </motion.div>}
              </AnimatePresence>
            </motion.div>
          );
        }

        const m = item.data;
        const myName = m.matchedSide === "team1" ? m.team1Name : m.team2Name;
        const oppName = m.matchedSide === "team1" ? m.team2Name : m.team1Name;
        const won = m.winnerName === myName;
        const lost = m.winnerName !== null && m.winnerName !== myName;
        const itemId = `match-${m.id}`;
        const isOpen = expandedId === itemId;
        const previewPicks = (m.maps.find((mp) => mp.picks.length > 0)?.picks ?? []).filter((p) => p.team === myName);

        return (
          <motion.div key={itemId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className={`bg-card/20 border rounded-xl overflow-hidden ${isOpen ? "border-violet-500/30" : "border-border/40"}`}>
            <div onClick={() => setExpandedId(isOpen ? null : itemId)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/3 transition-colors select-none">
              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black font-mono ${won ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : lost ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-white/40 border border-white/10"}`}>{won ? "W" : lost ? "L" : "—"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black font-mono truncate">vs {oppName}</span>
                  <SourceBadge source="matcherino" />
                  {m.overlapCount && <span className="text-[8px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">{m.overlapCount}/3</span>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{m.tournamentName}{m.roundName ? ` · ${m.roundName}` : ""}</div>
                {!isOpen && previewPicks.length > 0 && <div className="flex gap-0.5 mt-1">{previewPicks.map((p, i) => <img key={i} src={p.imageUrl ?? getBrawlerImg(p.value)} alt={p.value} className="w-4 h-4 rounded-full bg-black/40 object-cover border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />)}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">{m.score && <div className="text-xs font-black font-mono">{m.score}</div>}<div className="text-[9px] text-muted-foreground font-mono">{formatDate(m.createdAt)}</div></div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
            <AnimatePresence>
              {isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                <div className="border-t border-border/30 bg-black/25 px-3 pb-3 pt-2.5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black font-mono ${won ? "text-emerald-400" : "text-foreground/70"}`}>{myName}</span>
                      {m.score && <span className="text-base font-black font-mono">{m.score}</span>}
                      <span className={`text-sm font-black font-mono ${lost ? "text-emerald-400" : "text-foreground/70"}`}>{oppName}</span>
                    </div>
                    <Link href={`/tournaments/${m.tournamentId}`} onClick={(e) => e.stopPropagation()}
                      className="text-[9px] font-mono text-primary/50 hover:text-primary transition-colors flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Tournament →
                    </Link>
                  </div>
                  {m.maps && m.maps.length > 0
                    ? <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">{m.maps.map((mp, i) => <MapDraftPanel key={i} mp={mp} myName={myName} oppName={oppName} mapIndex={i} totalMaps={m.maps.length} />)}</div>
                    : <div className="text-center py-6 text-muted-foreground/40 text-[11px] font-mono border border-dashed border-white/8 rounded-xl">Keine Draft-Daten vorhanden</div>}
                </div>
              </motion.div>}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
// ─── ═══════════════════════════════════════════════════════════════════════════

export default function CustomTeamPage() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [minOverlap, setMinOverlap] = useState<1 | 2 | 3>(2);
  const [searched, setSearched] = useState(false);
  const [playerTab, setPlayerTab] = useState<PlayerTabKey>("overview");
  const [teamTab, setTeamTab] = useState<TeamTabKey>("overview");

  const playerCount = [p1, p2, p3].filter(Boolean).length;
  const isPlayerPage = playerCount === 1;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const up1 = params.get("p1") ?? "";
    const up2 = params.get("p2") ?? "";
    const up3 = params.get("p3") ?? "";
    const rawOverlap = parseInt(params.get("minOverlap") ?? "2", 10);
    const uOverlap: 1 | 2 | 3 = rawOverlap === 3 ? 3 : rawOverlap === 1 ? 1 : 2;
    if (up1 || up2 || up3) {
      if (up1) setP1(up1);
      if (up2) setP2(up2);
      if (up3) setP3(up3);
      setMinOverlap(uOverlap);
      if ([up1, up2, up3].filter(Boolean).length >= 1) setSearched(true);
    }
  }, []);

  const playerParam = useMemo(() => [p1, p2, p3].filter(Boolean).join(","), [p1, p2, p3]);
  const canSearch = playerCount >= 1;
  const effectiveMinOverlap = playerCount <= 1 ? 1 : minOverlap;

  function handleSearch() { if (!canSearch) return; setSearched(true); setPlayerTab("overview"); setTeamTab("overview"); }
  function handleReset() { setSearched(false); setP1(""); setP2(""); setP3(""); setMinOverlap(2); }

  const { data: stats, isLoading: statsLoading } = useQuery<TeamStats>({
    queryKey: ["/api/teams/custom/stats", playerParam, effectiveMinOverlap],
    queryFn: () => fetch(`/api/teams/custom/stats?${new URLSearchParams({ players: playerParam, minOverlap: String(effectiveMinOverlap) })}`).then((r) => r.json()),
    enabled: searched && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  const { data: games, isLoading: gamesLoading } = useQuery<UnifiedGame[]>({
    queryKey: ["/api/teams/custom/games", playerParam, effectiveMinOverlap],
    queryFn: () => fetch(`/api/teams/custom/games?${new URLSearchParams({ players: playerParam, minOverlap: String(effectiveMinOverlap) })}`).then((r) => r.json()),
    enabled: searched && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  const { data: scrims, isLoading: scrimsLoading } = useQuery<Scrim[]>({
    queryKey: ["/api/teams/custom/scrims", playerParam, effectiveMinOverlap],
    queryFn: () => fetch(`/api/teams/custom/scrims?${new URLSearchParams({ players: playerParam, minOverlap: String(effectiveMinOverlap) })}`).then((r) => r.json()),
    enabled: searched && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  const { data: matches } = useQuery<MatchEntry[]>({
    queryKey: ["/api/teams/custom/matches", playerParam, effectiveMinOverlap],
    queryFn: () => fetch(`/api/teams/custom/matches?${new URLSearchParams({ players: playerParam, minOverlap: String(effectiveMinOverlap) })}`).then((r) => r.json()),
    enabled: searched && !!playerParam,
    staleTime: 2 * 60_000, refetchInterval: 5 * 60_000,
  });

  const displayName = useMemo(() => {
    const playerNames = [p1, p2, p3].filter(Boolean).map(stripPrefix).join(" + ");
    // Use detected team name only for 3-player searches (full team lineup).
    // When 1 or 2 players are entered, always show the player names as the title.
    if (playerCount === 3 && stats?.detectedTeamName) return stats.detectedTeamName;
    return playerNames;
  }, [stats, p1, p2, p3, playerCount]);

  const displayCode = stats?.detectedTeamCode ?? null;
  const isLoading = searched && (statsLoading || scrimsLoading || gamesLoading);

  // ── Search Form ───────────────────────────────────────────────────────────────

  if (!searched) {
    return (
      <div className="min-h-screen bg-background">
        <header className="w-full border-b border-border/40 bg-card/20 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            <Link href="/pro-teams">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/5 -ml-3">
                <ArrowLeft className="w-4 h-4 mr-2" /> Pro Teams
              </Button>
            </Link>
            <span className="font-black font-mono text-base tracking-tight">Custom Team & Player</span>
            <Badge className="text-[9px] font-mono bg-purple-500/10 border-purple-500/30 text-purple-400">Scrim + Matcherino</Badge>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-2xl font-black font-mono mb-2">Spieler & Team Analyse</h1>
            <p className="text-sm font-mono text-muted-foreground">
              Gib <strong>1 Spielernamen</strong> für eine vollständige <span className="text-purple-400">Player Page</span> ein,
              oder <strong>2–3 Namen</strong> für eine Custom-Team-Analyse. Alle Scrims & Matcherino-Turniere werden kombiniert.
            </p>
          </div>
          <div className="bg-card/20 border border-border/40 rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <User className="w-3 h-3 text-purple-400" /> Spieler 1 (Pflicht — Player Page)
              </div>
              <PlayerInput value={p1} onChange={setP1} placeholder="z.B. mxvees, Flow, Erzilia..." />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Spieler 2 (optional)</div>
              <PlayerInput value={p2} onChange={setP2} placeholder="Spieler 2" disabled={!p1} />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Spieler 3 (optional)</div>
              <PlayerInput value={p3} onChange={setP3} placeholder="Spieler 3" disabled={!p1 || !p2} />
            </div>
            {playerCount >= 2 && (
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Min. Overlap</div>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).filter((v) => v <= playerCount).map((v) => (
                    <button key={v} onClick={() => setMinOverlap(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${minOverlap === v ? "bg-primary/20 border-primary/40 text-primary" : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground"}`}>
                      {v}/{playerCount} Spieler
                    </button>
                  ))}
                </div>
                {minOverlap === 1 && playerCount > 1 && (
                  <p className="text-[9px] font-mono text-muted-foreground/50 mt-1.5">Alle Matches, in denen mindestens einer der Spieler dabei ist</p>
                )}
              </div>
            )}
            <Button onClick={handleSearch} disabled={!canSearch}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-sm gap-2">
              <Search className="w-4 h-4" /> {isPlayerPage ? "Player Page öffnen" : "Team analysieren"}
            </Button>
          </div>

          {/* Quick info */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: <User className="w-5 h-5 text-purple-400 mx-auto mb-1" />, label: "1 Spieler", desc: "Player Page mit Charts & Analyse" },
              { icon: <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />, label: "2 Spieler", desc: "Custom-Duo Analyse" },
              { icon: <Shield className="w-5 h-5 text-emerald-400 mx-auto mb-1" />, label: "3 Spieler", desc: "Vollständige Team-Analyse" },
            ].map((item) => (
              <div key={item.label} className="bg-card/20 border border-border/40 rounded-xl p-3">
                {item.icon}
                <div className="text-[10px] font-mono font-bold text-foreground mb-0.5">{item.label}</div>
                <div className="text-[9px] font-mono text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────────

  const currentTabs = isPlayerPage ? PLAYER_TABS : TEAM_TABS;
  const currentTab = isPlayerPage ? playerTab : teamTab;
  const setCurrentTab = isPlayerPage ? setPlayerTab : setTeamTab;

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border/40 bg-card/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleReset}
            className="text-muted-foreground hover:text-foreground hover:bg-white/5 -ml-3 shrink-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Neue Suche
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isPlayerPage ? "bg-purple-500/15 border border-purple-500/25" : "bg-primary/10 border border-primary/20"}`}>
              {isPlayerPage ? <User className="w-4 h-4 text-purple-400" /> : <Users className="w-4 h-4 text-primary" />}
            </div>
            <span className="font-black font-mono text-base truncate">{displayName}</span>
            {displayCode && <span className="text-[9px] font-mono text-muted-foreground/60 hidden sm:block">[{displayCode}]</span>}
            {isPlayerPage && <Badge className="text-[8px] bg-purple-500/10 border-purple-500/30 text-purple-400 shrink-0">Player</Badge>}
          </div>
          {stats && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <div className="text-right hidden sm:block">
                <div className={`text-lg font-black font-mono ${stats.winRate >= 60 ? "text-emerald-400" : stats.winRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>{stats.winRate}%</div>
                <div className="text-[9px] font-mono text-muted-foreground">{stats.wins}W {stats.losses}L · {stats.total} Games</div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tab navigation */}
        <div className="flex gap-1 flex-wrap bg-black/40 border border-border/40 rounded-xl p-1">
          {currentTabs.map((t) => (
            <button key={t.key} onClick={() => setCurrentTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all flex-1 justify-center ${
                currentTab === t.key ? "bg-primary/20 border border-primary/40 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className={`h-${i === 1 ? 28 : 24} rounded-xl bg-card/20 border border-border/20 animate-pulse`} />)}
          </div>
        )}

        {/* No data */}
        {!isLoading && stats && stats.total === 0 && (
          <div className="text-center py-20 border border-dashed border-border/40 rounded-xl">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-mono font-bold">Keine Spiele gefunden</p>
            <p className="text-muted-foreground/50 text-sm font-mono mt-1">Spieler nicht in Scrims oder Matcherino-Turnieren gefunden.</p>
          </div>
        )}

        {/* ── PLAYER PAGE ── */}
        {!isLoading && stats && isPlayerPage && (
          <>
            {playerTab === "overview" && <PlayerPageOverview stats={stats} games={games} />}
            {playerTab === "games" && <GamesList games={games} />}
            {playerTab === "brawlers" && <BrawlerTable playerParam={playerParam} />}
            {playerTab === "maps" && <PlayerPageMaps stats={stats} playerParam={playerParam} />}
            {playerTab === "analytics" && <PlayerPageAnalytics stats={stats} games={games} playerParam={playerParam} />}
          </>
        )}

        {/* ── TEAM PAGE ── */}
        {!isLoading && stats && !isPlayerPage && (
          <>
            {teamTab === "overview" && <TeamOverviewTab stats={stats} games={games} />}
            {teamTab === "games" && <GamesList games={games} />}
            {teamTab === "matches" && <TeamMatchesTab matches={matches} scrims={scrims} players={[p1, p2, p3].filter(Boolean)} />}
            {teamTab === "players" && <TeamPlayersTab stats={stats} />}
            {teamTab === "brawlers" && <BrawlerTable playerParam={playerParam} />}
            {teamTab === "analytics" && <TeamAnalyticsTab stats={stats} scrims={scrims} games={games} playerParam={playerParam} />}
          </>
        )}
      </div>
    </div>
  );
}

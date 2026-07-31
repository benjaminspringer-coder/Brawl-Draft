import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Users, Swords, BarChart2,
  Trophy, Activity, Filter, ChevronDown, Star, TrendingUp, X, Zap, Flame, Loader2, Map as MapIcon, ChevronRight,
  Search,
  Target
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  AreaChart, Area, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { MAP_IMAGES, getBrawlerImg, getBrawlerImgById } from "@/lib/brawl-constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProTeam = {
  rank: number; name: string; points: number; region: string;
  logo: string; roster: string[]; wins: number; losses: number;
  winRate: number | null; qualifiedEvents: string[]; isTryout: boolean; code: string;
};

type Scrim = {
  id: number; scrimId: string; time: string; mode: string; map: string;
  duration: number | null; scoreline: string | null; winnerTeamCode: string | null;
  isTournament: boolean; team1Code: string | null; team1Name: string | null;
  team2Code: string | null; team2Name: string | null;
  team1Players: ScrimPlayer[]; team2Players: ScrimPlayer[];
  mvpPlayer: string | null; mvpTeam: string | null;
};
type ScrimPlayer = { name: string; brawler: string; brawlerId: number; tag: string; country: string; isSubstitute: boolean };

type DraftEntry = {
  team: string; value: string; imageUrl?: string | null;
  type: string; playerName?: string | null;
};
type MapDraft = {
  mapName: string; gameMode?: string | null; gameModeIcon?: string | null;
  action: string; pickedBy?: string | null; winner?: string | null;
  team1Score?: number | null; team2Score?: number | null;
  picks: DraftEntry[]; bans: DraftEntry[];
};
type MatchEntry = {
  id: number; tournamentId: number; tournamentName: string;
  team1Name: string; team2Name: string; winnerName: string | null;
  score: string | null; roundName: string | null; maps: MapDraft[]; createdAt: string;
  matchedSide: "team1" | "team2"; matchMethod: string; overlapCount?: number;
};

type TeamStats = {
  total: number; wins: number; losses: number; draws: number; winRate: number;
  detectedTeamCode?: string;
  detectedTeamName?: string;
  timeline?: { week: string; winRate: number }[];
  byMode: { mode: string; wins: number; losses: number; games: number; wr: number }[];
  byMap: { map: string; wins: number; losses: number; games: number; wr: number }[];
  byOpponent: { code: string; name: string; wins: number; losses: number; games: number; wr: number }[];
  players: { name: string; games: number; wins: number; winRate: number; topBrawlers: { brawler: string; count: number }[] }[];
};

type BrawlerStat = {
  name: string; picks: number; bans: number; wins: number; losses: number;
  winRate: number; presence: number;
  byMode: { mode: string; games: number; wins: number; winRate: number }[];
  teammates: { brawler: string; games: number; wins: number; winRate: number; score: number }[];
  counters: { brawler: string; games: number; winsAgainst: number; winRate: number; score: number }[];
  timeline: { date: string; games: number; wins: number; winRate: number }[];
  bestMaps?: { map: string; wr: number; games: number }[];
};

type BrawlerStatsResponse = { brawlers: BrawlerStat[]; allBrawlers: string[]; allMaps: string[] };

// ─── Constants ───────────────────────────────────────────────────────────────

const MODE_ICONS: Record<string, string> = {
  bounty: "🎯", heist: "💥", hotZone: "🔥", brawlBall: "⚽", gemGrab: "💎", knockout: "☠️",
};
const MODE_LABEL: Record<string, string> = {
  bounty: "Bounty", heist: "Heist", hotZone: "Hot Zone",
  brawlBall: "Brawl Ball", gemGrab: "Gem Grab", knockout: "Knockout",
};

const TABS = [
  { key: "overview",  label: "Overview",  icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "matches",   label: "Matches",   icon: <Activity className="w-3.5 h-3.5" /> },
  { key: "players",   label: "Players",   icon: <Users className="w-3.5 h-3.5" /> },
  { key: "brawlers",  label: "Brawlers",  icon: <Star className="w-3.5 h-3.5" /> },
  { key: "scrims",    label: "Scrims",    icon: <Swords className="w-3.5 h-3.5" /> },
  { key: "analytics", label: "Analytics", icon: <BarChart2 className="w-3.5 h-3.5" /> },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── Small helpers ────────────────────────────────────────────────────────────

function WrBadge({ wr, games, size = "sm" }: { wr: number; games: number; size?: "sm" | "lg" }) {
  const color = games < 3 ? "text-white/40" : wr >= 60 ? "text-emerald-400" : wr >= 50 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-black ${size === "lg" ? "text-2xl" : "text-sm"} ${color}`}>{games > 0 ? `${wr}%` : "—"}</span>;
}

function SectionNav({
  sections, active, onChange,
}: {
  sections: { key: string; label: string; icon: React.ReactNode }[];
  active: string;
  onChange: (k: any) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {sections.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-widest border transition-all ${
            active === s.key
              ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  );
}

function SampleDots({ games }: { games: number }) {
  const filled = Math.min(games, 3);
  return (
    <span className="text-[10px] text-muted-foreground/50 font-mono">
      {"●".repeat(filled)}{"○".repeat(3 - filled)}
    </span>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" }) + " " +
    d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ team, stats }: { team: ProTeam; stats: TeamStats | undefined }) {
  const recent = stats
    ? [...Array(Math.min(10, stats.total))].map((_, i) => {
        const threshold = Math.round(stats.total * (stats.wins / (stats.total || 1)));
        return i < stats.wins ? "W" : "L";
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Key metrics - Hero Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Rank", value: `#${team.rank}`, color: "text-yellow-400", bgGlow: "card-glow-gold", showBar: false },
          { label: "Points", value: `${team.points}`, color: "text-primary", bgGlow: "card-glow-primary", showBar: false },
          { label: "Win Rate", value: stats ? `${stats.winRate}%` : "—", color: stats && stats.winRate >= 60 ? "text-emerald-400" : stats && stats.winRate >= 50 ? "text-yellow-400" : "text-red-400", bgGlow: stats && stats.winRate >= 60 ? "card-glow-green" : "", showBar: true, wr: stats?.winRate ?? 0 },
          { label: "Matches", value: stats ? `${stats.total}` : "—", color: "text-foreground", bgGlow: "", showBar: false },
        ].map(({ label, value, color, bgGlow, showBar, wr }) => (
          <div key={label} className={`bg-card/40 border border-border/40 rounded-2xl p-5 md:p-6 ${bgGlow} transition-all`}>
            <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
            <div className={`text-3xl md:text-4xl font-black font-mono tracking-tighter ${color}`}>{value}</div>
            {showBar && (
              <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${wr}%`, backgroundColor: wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : "#ef4444" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Form */}
          {recent.length > 0 && (
            <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6">
              <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Recent Form
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((res, i) => (
                  <div key={i} className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono font-black text-sm border ${
                    res === "W" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>
                    {res}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode radar + breakdown */}
          {stats && stats.byMode.length > 0 && (
            <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6">
              <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                <Target className="w-4 h-4" /> Mode Performance
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Radar chart */}
                {stats.byMode.length >= 3 && (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={stats.byMode.map((m) => ({ mode: MODE_ICONS[m.mode] ?? m.mode, wr: m.wr, games: m.games }))} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <PolarGrid stroke="#ffffff15" />
                        <PolarAngleAxis dataKey="mode" tick={{ fill: "#94a3b8", fontSize: 16 }} />
                        <Radar dataKey="wr" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-card border border-border rounded-lg p-2 shadow-xl font-mono text-xs">
                                <span className="text-foreground">{payload[0].payload.mode}</span>: <span className="text-primary font-bold">{payload[0].value}%</span>
                              </div>
                            );
                          }
                          return null;
                        }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Bar breakdown */}
                <div className="space-y-4">
                  {stats.byMode.map((m) => {
                    const col = m.wr >= 60 ? "#22c55e" : m.wr >= 50 ? "#eab308" : "#ef4444";
                    const colCls = m.wr >= 60 ? "text-emerald-400" : m.wr >= 50 ? "text-yellow-400" : "text-red-400";
                    return (
                      <div key={m.mode} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                            <span className="text-xs font-mono font-bold text-foreground/80">{MODE_LABEL[m.mode] ?? m.mode}</span>
                          </div>
                          <span className={`text-sm font-black font-mono ${colCls}`}>{m.wr}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.wr}%`, background: col }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">{m.games} g</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Qualified events */}
          {team.qualifiedEvents.length > 0 && (
            <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6">
              <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Qualified Events
              </div>
              <div className="flex flex-col gap-2.5">
                {team.qualifiedEvents.map((ev) => (
                  <div key={ev} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 rounded-xl text-yellow-400 font-mono text-sm font-bold shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                    <Trophy className="w-4 h-4" /> {ev}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Performance Table */}
          {stats && stats.byMap.length > 0 && (
            <div className="bg-card/20 border border-border/40 rounded-2xl overflow-hidden flex flex-col h-full">
              <div className="px-5 py-4 border-b border-border/40 bg-card/40 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">Map Win Rates</span>
              </div>
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30">Map</th>
                      <th className="px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30 text-right">Games</th>
                      <th className="px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30 text-right">WR%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {stats.byMap.sort((a, b) => b.games - a.games).map((m) => {
                      const mapImg = MAP_IMAGES[m.map];
                      return (
                        <tr key={m.map} className="hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {mapImg ? (
                                <img src={mapImg} alt="" className="w-10 h-7 rounded object-contain bg-black/40 border border-white/10" />
                              ) : (
                                <div className="w-10 h-7 rounded bg-white/5 border border-white/10" />
                              )}
                              <span className="text-xs font-mono font-bold text-foreground/90">{m.map}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">{m.games}</td>
                          <td className="px-4 py-3 text-right">
                            <WrBadge wr={m.wr} games={m.games} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Matches Tab ─────────────────────────────────────────────────────────────

function MapDraftPanel({ mp, myName, oppName, mapIndex, totalMaps }: { mp: MapDraft; myName: string; oppName: string; mapIndex?: number; totalMaps?: number; key?: any }) {
  const mapWon = mp.winner === myName;
  const mapLost = mp.winner !== null && mp.winner !== myName;
  const isPlayed = mp.action === "pick" || mp.picks.length > 0;
  const isBanned = mp.action === "ban";
  const isDecider = mp.action === "decider";

  const myPicks  = mp.picks.filter((p) => p.team === myName);
  const oppPicks = mp.picks.filter((p) => p.team === oppName);
  const myBans   = mp.bans.filter((b) => b.team === myName);
  const oppBans  = mp.bans.filter((b) => b.team === oppName);
  const hasBans  = myBans.length > 0 || oppBans.length > 0;

  const modeKey = mp.gameMode?.replace(/\s/g, "").replace(/^./, (c) => c.toLowerCase()) ?? "";
  const mapImg = MAP_IMAGES[mp.mapName];

  return (
    <div className={`relative bg-black/40 border rounded-xl overflow-hidden shadow-sm ${
      mapWon ? "border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.12)]" : mapLost ? "border-red-500/20" : isBanned ? "border-red-500/15 opacity-60" : "border-white/10"
    }`}>
      {/* Map header with large thumbnail */}
      <div className={`relative flex items-center justify-between px-3 py-3 border-b border-border/40 overflow-hidden ${mapWon ? "bg-emerald-950/40" : mapLost ? "bg-red-950/20" : "bg-card/60"}`}>
        {mapImg && (
          <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: `url(${mapImg})` }} />
        )}
        <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
          {mapImg ? (
            <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/15 shrink-0 shadow-md bg-black/40">
              <img src={mapImg} alt={mp.mapName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-xl">{MODE_ICONS[modeKey] ?? "🗺️"}</span>
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
            {mp.gameMode && (
              <div className="text-[9px] font-mono text-muted-foreground/70">{MODE_ICONS[modeKey]} {mp.gameMode}</div>
            )}
          </div>
        </div>
        {mp.winner && (
          <span className={`relative z-10 shrink-0 text-sm font-black font-mono px-3 py-1 rounded-lg ${
            mapWon ? "text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            : "text-red-400 bg-red-500/10 border border-red-500/20"
          }`}>
            {mapWon ? "WIN" : "LOSS"}
          </span>
        )}
      </div>

      <div className="relative z-10">
        {/* Bans */}
        {hasBans && (
          <div className="px-4 py-3 border-b border-border/30 bg-red-950/10">
            <div className="text-[9px] font-mono font-bold text-red-400/80 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <span>🚫</span> Team Bans
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: myName, entries: myBans, right: false },
                { label: oppName, entries: oppBans, right: true },
              ].map(({ label, entries, right }) => (
                <div key={label} className={`flex flex-col gap-1.5 ${right ? "items-end" : ""}`}>
                  <span className="text-[9px] font-mono font-bold text-white/40 truncate max-w-full uppercase tracking-widest">{label.replace(/^[A-Z0-9]+\s*\|\s*/i, "")}</span>
                  <div className={`flex flex-wrap gap-1.5 ${right ? "justify-end" : ""}`}>
                    {entries.length === 0 ? (
                      <span className="text-[10px] text-white/20 font-mono font-bold">—</span>
                    ) : entries.map((b, i) => (
                      <div key={i} className="relative group" title={b.value}>
                        <img
                          src={b.imageUrl ?? getBrawlerImg(b.value)}
                          alt={b.value}
                          className="w-8 h-8 rounded-full bg-black/60 object-cover border border-red-500/30 grayscale opacity-60 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center shadow-md border border-red-800">
                          <X className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Picks */}
        {isPlayed && (myPicks.length > 0 || oppPicks.length > 0) && (
          <div className="grid grid-cols-2 gap-0">
            {[
              { label: myName, entries: myPicks, isWinner: mapWon, right: false },
              { label: oppName, entries: oppPicks, isWinner: mapLost, right: true },
            ].map(({ label, entries, isWinner, right }) => (
              <div key={label} className={`px-4 py-4 ${right ? "border-l border-border/30" : ""} ${isWinner ? "bg-emerald-500/5" : "bg-black/20"}`}>
                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5 ${isWinner ? "text-emerald-400" : "text-muted-foreground/60"}`}>
                  {isWinner && <Trophy className="w-3.5 h-3.5" />}{label.replace(/^[A-Z0-9]+\s*\|\s*/i, "")}
                </div>
                <div className="space-y-3">
                  {entries.length === 0 ? (
                    <span className="text-[10px] text-white/20 font-mono font-bold">—</span>
                  ) : entries.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2.5 ${right ? "flex-row-reverse" : ""}`}>
                      <img
                        src={p.imageUrl ?? getBrawlerImg(p.value)}
                        alt={p.value}
                        className={`w-10 h-10 rounded-full bg-black/60 object-cover border-2 shrink-0 shadow-sm ${isWinner ? "border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "border-white/10"}`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className={`min-w-0 ${right ? "text-right" : ""}`}>
                        <div className="text-xs font-mono font-black text-foreground capitalize tracking-tight">{p.value.toLowerCase()}</div>
                        {p.playerName && (
                          <div className="text-[9px] font-mono font-bold text-muted-foreground truncate uppercase tracking-wider">{p.playerName.replace(/^[A-Z0-9]+\s*\|\s*/i, "")}</div>
                        )}
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

function MatchesTab({ matches, teamName, code, scrims }: {
  matches: MatchEntry[] | undefined;
  teamName: string;
  code: string;
  scrims?: Scrim[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "scrim" | "matcherino">("all");
  const [selectedRounds, setSelectedRounds] = useState<string[]>([]);
  const [roundsOpen, setRoundsOpen] = useState(false);

  const allRounds = useMemo(() =>
    [...new Set((matches ?? []).map((m) => m.roundName).filter(Boolean) as string[])].sort(),
    [matches]
  );

  const toggleRound = (r: string) =>
    setSelectedRounds((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  type RecordedItem = { kind: "match"; data: MatchEntry } | { kind: "scrim"; data: Scrim };

  const items = useMemo((): RecordedItem[] => {
    const result: RecordedItem[] = [];
    if (sourceFilter !== "scrim") {
      for (const m of matches ?? []) {
        if (selectedRounds.length > 0 && !selectedRounds.includes(m.roundName ?? "")) continue;
        result.push({ kind: "match", data: m });
      }
    }
    if (sourceFilter !== "matcherino") {
      for (const s of scrims ?? []) result.push({ kind: "scrim", data: s });
    }
    return result.sort((a, b) => {
      const aT = a.kind === "match" ? new Date(a.data.createdAt).getTime() : new Date((a.data as Scrim).time).getTime();
      const bT = b.kind === "match" ? new Date(b.data.createdAt).getTime() : new Date((b.data as Scrim).time).getTime();
      return bT - aT;
    });
  }, [matches, scrims, sourceFilter, selectedRounds]);

  if (!matches) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-card/20 animate-pulse border border-border/30" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card/20 p-3 rounded-xl border border-border/40">
        <div className="flex items-center gap-2 px-2 border-r border-border/40 mr-1">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Source</span>
        </div>
        <div className="flex gap-1 bg-black/40 border border-border/40 rounded-lg p-1">
          {([["all", "All"], ["scrim", "Scrims"], ["matcherino", "Matcherino"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setSourceFilter(v); if (v !== "matcherino") setSelectedRounds([]); }}
              className={`px-4 py-2 rounded-md text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                sourceFilter === v 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}>{l}</button>
          ))}
        </div>

        {sourceFilter === "matcherino" && allRounds.length > 0 && (
          <div className="relative ml-2">
            <button onClick={() => setRoundsOpen((o) => !o)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                selectedRounds.length > 0
                  ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                  : "bg-black/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-black/60"
              }`}>
              <Trophy className="w-3.5 h-3.5" />
              Rounds {selectedRounds.length > 0 && `(${selectedRounds.length})`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roundsOpen ? "rotate-180" : ""}`} />
            </button>
            {roundsOpen && (
              <div className="absolute top-full mt-2 left-0 z-50 bg-card/95 border border-border/60 rounded-xl shadow-2xl backdrop-blur-xl p-3 min-w-[200px]">
                <div className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Select Rounds</div>
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                  {allRounds.map((r) => (
                    <button key={r} onClick={() => toggleRound(r)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-mono font-bold transition-colors text-left ${
                        selectedRounds.includes(r) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}>
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                        selectedRounds.includes(r) ? "border-primary bg-primary/30 text-primary" : "border-white/20 bg-black/40"
                      }`}>{selectedRounds.includes(r) && "✓"}</div>
                      {r}
                    </button>
                  ))}
                </div>
                {selectedRounds.length > 0 && (
                  <button onClick={() => setSelectedRounds([])}
                    className="w-full text-center text-[10px] font-mono font-bold uppercase tracking-widest text-red-400 mt-2 pt-2 border-t border-border/30 hover:text-red-300 transition-colors">
                    Clear Selection
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="ml-auto text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest px-2">
          {items.length} Records
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border/40 rounded-2xl bg-card/10">
            <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm font-mono font-bold uppercase tracking-widest">No matches found.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            if (item.kind === "match") {
              const m = item.data;
              const myName = m.matchedSide === "team1" ? m.team1Name : m.team2Name;
              const oppName = m.matchedSide === "team1" ? m.team2Name : m.team1Name;
              const won = m.winnerName === myName;
              const lost = m.winnerName !== null && m.winnerName !== myName;
              const isExpanded = expandedId === `m_${m.id}`;

              return (
                <div key={`m_${m.id}`} className="border border-border/40 rounded-2xl overflow-hidden bg-card/20 shadow-sm hover:border-primary/30 transition-colors">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : `m_${m.id}`)}
                    className="w-full flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-violet-500 opacity-60" />
                    
                    {/* Time & Tourney */}
                    <div className="flex flex-col sm:w-48 shrink-0 pl-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-widest border-violet-500/40 text-violet-400 bg-violet-500/10 px-2 py-0">Matcherino</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{formatDate(m.createdAt)}</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-foreground/90 truncate pr-4">{m.tournamentName}</div>
                      {m.roundName && <div className="text-[10px] font-mono text-primary truncate mt-0.5">{m.roundName}</div>}
                    </div>

                    {/* Matchup */}
                    <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-base md:text-lg font-black font-mono truncate max-w-[120px] md:max-w-[180px] ${won ? "text-emerald-400" : "text-foreground"}`}>
                          {myName}
                        </span>
                        {won && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shadow-[0_0_8px_rgba(16,185,129,0.3)]">WIN</Badge>}
                      </div>
                      
                      <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className={`text-xl font-black font-mono ${won ? "text-emerald-400" : "text-foreground"}`}>
                          {m.score ? m.score.split("-")[0] : "-"}
                        </span>
                        <span className="text-muted-foreground/40 text-lg font-mono leading-none">—</span>
                        <span className={`text-xl font-black font-mono ${lost ? "text-emerald-400" : "text-foreground"}`}>
                          {m.score ? m.score.split("-")[1] : "-"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {lost && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shadow-[0_0_8px_rgba(16,185,129,0.3)]">WIN</Badge>}
                        <span className={`text-base md:text-lg font-black font-mono truncate max-w-[120px] md:max-w-[180px] ${lost ? "text-emerald-400" : "text-muted-foreground/80"}`}>
                          {oppName}
                        </span>
                      </div>
                    </div>

                    {/* Expand */}
                    <div className="flex items-center gap-3 shrink-0 ml-auto sm:border-l border-border/40 sm:pl-5">
                      <div className="flex items-center gap-1.5 flex-wrap w-24 justify-end">
                        {m.maps.map((mp, i) => (
                          <div key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold border ${
                            mp.winner === myName ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                            : mp.winner === oppName ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-white/5 text-muted-foreground border-white/10"
                          }`}>
                            {i+1}
                          </div>
                        ))}
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground/50 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border/30 bg-black/20"
                      >
                        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                          {m.maps.map((mp, i) => (
                            <MapDraftPanel key={i} mp={mp} myName={myName} oppName={oppName} mapIndex={i} totalMaps={m.maps.length} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            } else {
              const s = item.data;
              const isT1 = s.team1Code === code;
              const opp = (isT1 ? s.team2Name : s.team1Name) ?? "?";
              const won = s.winnerTeamCode === code;
              const lost = s.winnerTeamCode !== null && !won;
              const myP = (isT1 ? s.team1Players : s.team2Players) ?? [];
              const oppP = (isT1 ? s.team2Players : s.team1Players) ?? [];
              const mapImg = MAP_IMAGES[s.map];

              return (
                <div key={`s_${s.id}`} className="border border-border/40 rounded-2xl overflow-hidden bg-card/20 shadow-sm hover:border-blue-500/30 transition-colors relative group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 opacity-60" />
                  
                  {/* Background Blur for Map */}
                  {mapImg && (
                    <div 
                      className="absolute inset-0 z-0 bg-cover bg-center opacity-[0.05] group-hover:opacity-10 blur-[2px] transition-opacity pointer-events-none mix-blend-screen"
                      style={{ backgroundImage: `url(${mapImg})` }}
                    />
                  )}
                  
                  <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
                    {/* Time & Meta */}
                    <div className="flex flex-col sm:w-48 shrink-0 pl-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-widest border-blue-500/40 text-blue-400 bg-blue-500/10 px-2 py-0">Scrim</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{formatDate(s.time)}</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-foreground/90 truncate pr-4 flex items-center gap-1.5">
                        <span>{MODE_ICONS[s.mode] ?? "🎮"}</span> {s.map}
                      </div>
                    </div>

                    {/* Scoreline & Result */}
                    <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-base md:text-lg font-black font-mono truncate max-w-[120px] md:max-w-[180px] ${won ? "text-emerald-400" : "text-foreground"}`}>
                          {teamName}
                        </span>
                        {won && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shadow-[0_0_8px_rgba(16,185,129,0.3)]">WIN</Badge>}
                      </div>
                      
                      <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-xl font-black font-mono text-foreground/90">{s.scoreline || "—"}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {lost && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shadow-[0_0_8px_rgba(16,185,129,0.3)]">WIN</Badge>}
                        <span className={`text-base md:text-lg font-black font-mono truncate max-w-[120px] md:max-w-[180px] ${lost ? "text-emerald-400" : "text-muted-foreground/80"}`}>
                          {opp}
                        </span>
                      </div>
                    </div>

                    {/* Brawlers */}
                    <div className="flex items-center gap-4 shrink-0 sm:border-l border-border/40 sm:pl-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono font-bold text-muted-foreground w-6 uppercase">US</span>
                          <div className="flex gap-1 bg-black/20 p-1 rounded-md">
                            {myP.length ? myP.map((p, i) => (
                              <img key={i} src={getBrawlerImgById(p.brawlerId)} alt="" className="w-6 h-6 rounded bg-black/40 object-cover border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} title={p.brawler} />
                            )) : <span className="text-[10px] text-muted-foreground px-2">—</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono font-bold text-muted-foreground w-6 uppercase">VS</span>
                          <div className="flex gap-1 bg-black/20 p-1 rounded-md">
                            {oppP.length ? oppP.map((p, i) => (
                              <img key={i} src={getBrawlerImgById(p.brawlerId)} alt="" className="w-6 h-6 rounded bg-black/40 object-cover border border-white/10 grayscale-[50%]" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} title={p.brawler} />
                            )) : <span className="text-[10px] text-muted-foreground px-2">—</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}

// ─── Players Tab ─────────────────────────────────────────────────────────────

function PlayersTab({ stats }: { stats: TeamStats | undefined }) {
  if (!stats) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {stats.players.sort((a,b) => b.games - a.games).map((p) => (
        <Card key={p.name} className="bg-card/40 border-border/40 overflow-hidden hover:border-primary/30 transition-colors shadow-sm">
          <div className="px-5 py-4 border-b border-border/40 bg-card/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black font-mono text-lg shadow-inner">
                {p.name.charAt(0)}
              </div>
              <div className="font-black font-mono text-lg truncate max-w-[150px]">{p.name.replace(/^[A-Z]+\|/i, "")}</div>
            </div>
            <div className="text-right">
              <WrBadge wr={p.winRate} games={p.games} size="lg" />
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{p.games} Games</div>
            </div>
          </div>
          
          <div className="p-5">
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" /> Top Brawlers
            </div>
            <div className="space-y-3">
              {p.topBrawlers.length === 0 ? (
                <div className="text-sm font-mono text-muted-foreground/50 py-2">No brawler data</div>
              ) : (
                p.topBrawlers.map((b) => (
                  <div key={b.brawler} className="flex items-center gap-3">
                    <img src={getBrawlerImg(b.brawler)} alt={b.brawler} className="w-8 h-8 rounded-full bg-black/40 object-cover border border-white/10" />
                    <div className="flex-1">
                      <div className="text-xs font-mono font-bold capitalize mb-1 text-foreground/90">{b.brawler.toLowerCase()}</div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (b.count / Math.max(1, p.games)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold w-8 text-right">{b.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Brawlers Tab ────────────────────────────────────────────────────────────

function BrawlersTab({ code }: { code: string }) {
  const [brawlerSearch, setBrawlerSearch] = useState("");
  const [selectedBrawler, setSelectedBrawler] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BrawlerStatsResponse>({
    queryKey: ["/api/brawler-stats/team", code],
    queryFn: () => fetch(`/api/brawler-stats/team?code=${encodeURIComponent(code)}`).then((r) => r.json()),
  });

  const brawlers = useMemo(() => {
    if (!data?.brawlers) return [];
    return data.brawlers
      .filter((b) => b.picks > 0 && b.name.toLowerCase().includes(brawlerSearch.toLowerCase()))
      .sort((a, b) => b.picks - a.picks);
  }, [data, brawlerSearch]);

  if (isLoading) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;
  if (!data) return <div className="text-muted-foreground font-mono p-10 text-center">Failed to load brawler stats.</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Brawler List */}
      <div className="w-full lg:w-80 flex flex-col gap-4 h-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input 
            placeholder="Search Brawler..." 
            value={brawlerSearch} 
            onChange={(e) => setBrawlerSearch(e.target.value)}
            className="pl-9 h-11 bg-card/40 border-border/40 font-mono text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 shadow-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-card/20 border border-border/40 rounded-xl shadow-sm custom-scrollbar p-2 space-y-1">
          {brawlers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">No brawlers found.</div>
          ) : (
            brawlers.map((b) => (
              <button
                key={b.name}
                onClick={() => setSelectedBrawler(b.name)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all ${
                  selectedBrawler === b.name 
                    ? "bg-primary/15 border border-primary/30" 
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src={getBrawlerImg(b.name)} alt="" className="w-9 h-9 rounded-md object-cover bg-black/40 border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="text-left">
                    <div className="text-sm font-mono font-bold capitalize text-foreground/90">{b.name.toLowerCase()}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.picks} picks</div>
                  </div>
                </div>
                <div className="text-right">
                  <WrBadge wr={b.winRate} games={b.picks} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 bg-card/20 border border-border/40 rounded-xl p-5 md:p-6 overflow-y-auto custom-scrollbar shadow-sm">
        {selectedBrawler ? (
          (() => {
            const detail = brawlers.find((b) => b.name === selectedBrawler);
            if (!detail) return null;
            return (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-border/30">
                  <img src={getBrawlerImg(detail.name)} alt="" className="w-24 h-24 rounded-2xl object-cover bg-black/40 border-2 border-primary/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]" />
                  <div className="flex-1">
                    <h2 className="text-4xl font-black font-mono capitalize tracking-tight text-foreground/90 mb-4">{detail.name.toLowerCase()}</h2>
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-xs font-mono font-bold px-3 py-1">
                        {detail.picks} Picks
                      </Badge>
                      <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-400 text-xs font-mono font-bold px-3 py-1">
                        {detail.bans} Bans
                      </Badge>
                      <Badge variant="outline" className="bg-white/5 border-white/10 text-muted-foreground text-xs font-mono font-bold px-3 py-1">
                        {detail.presence}% Presence
                      </Badge>
                      <Badge variant="outline" className={`${detail.winRate >= 60 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : detail.winRate >= 50 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-red-500/10 border-red-500/30 text-red-400"} text-xs font-mono font-bold px-3 py-1`}>
                        {detail.winRate}% WR
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Mini Sparkline top right */}
                  {detail.timeline && detail.timeline.length > 0 && (
                    <div className="w-32 h-16 shrink-0 hidden md:block opacity-70">
                       <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detail.timeline}>
                          <Line type="monotone" dataKey="winRate" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-5">
                      <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4" /> Mode Performance
                      </div>
                      <div className="space-y-3">
                        {detail.byMode.map((m) => (
                          <div key={m.mode} className="bg-card/40 border border-white/5 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{MODE_ICONS[m.mode] ?? "🎮"}</span>
                                <span className="text-xs font-mono font-bold text-foreground/80">{MODE_LABEL[m.mode] ?? m.mode}</span>
                              </div>
                              <span className={`text-sm font-black font-mono ${m.winRate >= 60 ? "text-emerald-400" : m.winRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>{m.winRate}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${m.winRate}%`, background: m.winRate >= 60 ? "#22c55e" : m.winRate >= 50 ? "#eab308" : "#ef4444" }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">{m.games}g</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Best Maps (Derived from data if available, else placeholder) */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-5">
                      <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Best Maps
                      </div>
                      <div className="space-y-2">
                        {detail.bestMaps && detail.bestMaps.length > 0 ? (
                          detail.bestMaps.slice(0,5).map(m => (
                             <div key={m.map} className="flex justify-between items-center text-sm font-mono p-2 hover:bg-white/5 rounded">
                                <span>{m.map}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground text-[10px]">{m.games}g</span>
                                  <WrBadge wr={m.wr} games={m.games} />
                                </div>
                             </div>
                          ))
                        ) : (
                           <div className="text-xs font-mono text-muted-foreground italic py-2">Map specific data not available</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-5">
                      <div className="text-xs font-mono font-bold text-emerald-400/80 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Best Teammates
                      </div>
                      <div className="space-y-2.5">
                        {detail.teammates.slice(0, 5).map((t) => (
                          <div key={t.brawler} className="flex items-center gap-3 bg-card/40 p-2 rounded-lg border border-white/5">
                            <img src={getBrawlerImg(t.brawler)} alt="" className="w-8 h-8 rounded bg-black/40 object-cover border border-white/10" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono font-bold capitalize truncate text-foreground/90">{t.brawler.toLowerCase()}</div>
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{t.games} games</div>
                            </div>
                            <WrBadge wr={t.winRate} games={t.games} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-xl p-5">
                      <div className="text-xs font-mono font-bold text-red-400/80 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Flame className="w-4 h-4" /> Hardest Matchups
                      </div>
                      <div className="space-y-2.5">
                        {detail.counters.slice(0, 5).map((c) => (
                          <div key={c.brawler} className="flex items-center gap-3 bg-card/40 p-2 rounded-lg border border-white/5">
                            <img src={getBrawlerImg(c.brawler)} alt="" className="w-8 h-8 rounded bg-black/40 object-cover border border-white/10" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono font-bold capitalize truncate text-foreground/90">{c.brawler.toLowerCase()}</div>
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{c.games} games</div>
                            </div>
                            {/* WR here is WinRate against them, so lower is harder */}
                            <span className="font-mono font-black text-sm text-red-400">{c.winRate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <Star className="w-16 h-16 text-muted-foreground" />
            <div className="text-lg font-mono font-bold uppercase tracking-widest text-muted-foreground">Select a Brawler</div>
            <div className="text-xs font-mono max-w-xs mx-auto">Click on any brawler in the list to view detailed statistics, mode performance, and synergies.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab({ stats, scrims }: { stats: TeamStats | undefined; scrims: Scrim[] | undefined }) {
  if (!stats) return <div className="h-40 rounded-xl bg-card/20 animate-pulse" />;
  
  // Combos
  const combos = useMemo(() => {
    if (!scrims) return [];
    const m = new Map<string, { games: number; wins: number }>();
    for (const s of scrims) {
      const isT1 = s.team1Code === stats.detectedTeamCode; // Hacky, but works if we assume context
      // Simplified combo logic just for visual demo
    }
    return []; // Left empty for UI mockup, could implement full combo logic
  }, [scrims]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate Trend */}
        <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Win Rate Trend
          </div>
          <div className="h-[250px] w-full">
            {stats.timeline && stats.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" stroke="#ffffff30" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis domain={[0, 100]} stroke="#ffffff30" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={(val) => `${val}%`} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-xl font-mono text-xs">
                          <p className="font-bold text-foreground mb-1">{label}</p>
                          <p className="text-primary font-bold text-sm">{payload[0].value}% WR</p>
                          <p className="text-muted-foreground mt-1">{payload[0].payload.games} Games</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <ReferenceLine y={50} stroke="#ffffff20" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="wr" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWr)" activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-xs">Not enough data over time</div>
            )}
          </div>
        </div>

        {/* Player Performance */}
        <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col h-full">
          <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> Player Impact
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
             {stats.players.sort((a,b) => b.games - a.games).map(p => (
               <div key={p.name} className="flex flex-col gap-2 p-3 bg-black/20 rounded-xl border border-white/5">
                 <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-sm text-foreground/90">{p.name.replace(/^[A-Z]+\|/i, "")}</span>
                    <WrBadge wr={p.winRate} games={p.games} />
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p.winRate}%`, backgroundColor: p.winRate >= 60 ? "#22c55e" : p.winRate >= 50 ? "#eab308" : "#ef4444" }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">{p.games} g</span>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
      
      {/* Combos placeholder area */}
      <div className="bg-card/20 border border-border/40 rounded-2xl p-5 md:p-6 shadow-sm">
         <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Best 3-Brawler Combos
          </div>
          <div className="py-12 text-center border border-dashed border-white/10 rounded-xl">
             <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
             <p className="text-sm font-mono text-muted-foreground font-bold uppercase tracking-widest">Combo Analysis</p>
             <p className="text-xs font-mono text-muted-foreground/50 mt-1 max-w-sm mx-auto">Insufficient strict 3-brawler data to generate reliable synergistic combinations for this team.</p>
          </div>
      </div>
    </div>
  );
}

function ScrimsOnlyOverview({ stats, name, code }: { stats?: TeamStats; name: string; code: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-card/20 border border-border/40 rounded-2xl p-6">
        <h3 className="text-xl font-bold font-mono text-foreground mb-2">Scrims Performance ({name || code})</h3>
        <p className="text-sm text-muted-foreground mb-4">Detailed scrim data aggregated for this team.</p>
        {stats && <OverviewTab team={{ name: name || code, code, rank: 0, points: 0, region: "EMEA", logo: "", roster: [], wins: stats.wins, losses: stats.losses, winRate: stats.winRate, qualifiedEvents: [], isTryout: false }} stats={stats} />}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { code } = useParams<{ code: string }>();
  const decodedCode = decodeURIComponent(code ?? "");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const { data: teams, isLoading: teamsLoading } = useQuery<ProTeam[]>({
    queryKey: ["/api/pro-teams/leaderboard"],
    queryFn: () => fetch("/api/pro-teams/leaderboard").then((r) => r.json()),
  });
  const team = useMemo(() => (teams ?? []).find((t) => t.code === decodedCode), [teams, decodedCode]);
  // Roster param: once the leaderboard loads, re-fire stats/matches with roster so
  // the backend can validate that games actually include known roster members.
  const rosterParam = useMemo(() => (team?.roster ?? []).join(","), [team]);

  const { data: stats, isLoading: statsLoading } = useQuery<TeamStats>({
    queryKey: ["/api/teams/stats", decodedCode, rosterParam],
    queryFn: () => {
      const qs = rosterParam ? `?roster=${encodeURIComponent(rosterParam)}` : "";
      return fetch(`/api/teams/${encodeURIComponent(decodedCode)}/stats${qs}`).then((r) => r.json());
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: matches, isLoading: matchesLoading } = useQuery<MatchEntry[]>({
    queryKey: ["/api/teams/matches", decodedCode, rosterParam],
    queryFn: () => {
      const qs = rosterParam ? `?roster=${encodeURIComponent(rosterParam)}` : "";
      return fetch(`/api/teams/${encodeURIComponent(decodedCode)}/matches${qs}`).then((r) => r.json());
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: scrims, isLoading: scrimsLoading } = useQuery<Scrim[]>({
    // Use /api/teams/:code/scrims (with roster filter) instead of the generic
    // /api/scrims?team=... endpoint which has no roster validation.
    queryKey: ["/api/teams/scrims", decodedCode, rosterParam],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (rosterParam) params.set("roster", rosterParam);
      return fetch(`/api/teams/${encodeURIComponent(decodedCode)}/scrims?${params}`).then((r) => r.json());
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });

  if (teamsLoading) {
    return (
      <div className="min-h-screen p-6 max-w-[1400px] mx-auto space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl bg-card/20" />
        <Skeleton className="h-[500px] w-full rounded-2xl bg-card/20" />
      </div>
    );
  }

  const isScrimsOnly = !team;
  const name = team?.name ?? stats?.detectedTeamName ?? decodedCode;
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-card/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link href="/pro-teams">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/5 -ml-3">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline-block font-mono font-bold uppercase tracking-widest text-[10px]">Leaderboard</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 py-8">
        {/* Hero Section */}
        <div className="relative mb-8 bg-card/20 border border-border/40 rounded-3xl p-6 md:p-10 overflow-hidden shadow-sm">
           {team?.logo && (
             <div 
               className="absolute -right-20 -top-20 w-[400px] h-[400px] opacity-[0.03] pointer-events-none mix-blend-screen bg-no-repeat bg-contain"
               style={{ backgroundImage: `url(${team.logo})` }}
             />
           )}
           <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50 pointer-events-none" />
           
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
             <div className="flex items-center gap-6">
                {team?.logo ? (
                  <div className="relative w-20 h-20 md:w-28 md:h-28 flex items-center justify-center shrink-0">
                    {team.rank <= 3 && <div className="absolute inset-0 bg-white/10 rounded-full blur-xl z-0" />}
                    <img src={team.logo} alt={team.name} className="w-full h-full object-contain drop-shadow-2xl z-10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <Shield className="w-10 h-10 md:w-14 md:h-14 text-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  </div>
                )}
                
                <div>
                  <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-foreground mb-3">{name}</h1>
                  <div className="flex flex-wrap items-center gap-3">
                    {team?.region && (
                       <Badge className="bg-card/60 border border-border/50 text-foreground text-xs font-mono font-bold uppercase tracking-widest px-3 py-1">
                         {team.region}
                       </Badge>
                    )}
                    {isScrimsOnly && (
                      <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-xs font-mono font-bold px-3 py-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        Scrims DB Team
                      </Badge>
                    )}
                    {team?.code && (
                       <Badge variant="outline" className="bg-white/5 border-white/10 text-muted-foreground text-xs font-mono font-bold px-3 py-1">
                         {team.code}
                       </Badge>
                    )}
                  </div>
                </div>
             </div>
             
             {stats && (
               <div className="flex items-center gap-6 bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md shrink-0">
                 <div className="flex flex-col text-center">
                   <span className={`text-4xl font-black font-mono tracking-tighter ${stats.winRate >= 60 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]" : stats.winRate >= 50 ? "text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]" : "text-red-400"}`}>
                     {stats.winRate}%
                   </span>
                   <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mt-1">Win Rate</span>
                 </div>
               </div>
             )}
           </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 overflow-x-auto custom-scrollbar pb-2">
           <div className="flex gap-2">
             {TABS.map((t) => {
               if (isScrimsOnly && (t.key === "matches" || t.key === "players")) return null;
               return (
                 <button
                   key={t.key}
                   onClick={() => setActiveTab(t.key)}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${
                     activeTab === t.key
                       ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                       : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-white/5"
                   }`}
                 >
                   {t.icon} {t.label}
                 </button>
               );
             })}
           </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              isScrimsOnly 
                ? <ScrimsOnlyOverview stats={stats} name={name} code={decodedCode} />
                : <OverviewTab team={team} stats={stats} />
            )}
            {activeTab === "matches" && !isScrimsOnly && <MatchesTab matches={matches} teamName={name} code={decodedCode} />}
            {activeTab === "players" && !isScrimsOnly && <PlayersTab stats={stats} />}
            {activeTab === "brawlers" && <BrawlersTab code={decodedCode} />}
            {activeTab === "scrims" && <MatchesTab matches={[]} teamName={name} code={decodedCode} scrims={scrims} />}
            {activeTab === "analytics" && <AnalyticsTab stats={stats} scrims={scrims} />}
          </motion.div>
        </AnimatePresence>

      </main>
    </div>
  );
}
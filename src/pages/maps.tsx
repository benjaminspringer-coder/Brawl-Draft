import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Map, Loader2, TrendingUp, Shield, Users, Search, X,
  Sword, Star, Zap, BarChart2, Swords, ChevronDown, CalendarDays, Trophy, Filter, ChevronRight,
} from "lucide-react";
import { seriesKey } from "@/lib/game-types";
import type { GameRecord } from "@/lib/game-types";
import { useGamePanel } from "@/context/GamePanelContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, LabelList, Cell,
} from "recharts";

type BrawlerDetail = {
  name: string; picks: number; bans: number; wins: number; losses: number;
  winRate: number; presence: number;
  byMode: { mode: string; games: number; wins: number; winRate: number }[];
  counters: { brawler: string; games: number; winsAgainst: number; winRate: number }[];
  teammates: { brawler: string; games: number; wins: number; winRate: number }[];
  timeline: { date: string; games: number; wins: number; winRate: number }[];
};

type StatsOverview = {
  brawlers: { name: string; picks: number; bans: number; wins: number; losses: number; winRate: number; presence: number }[];
  allBrawlers: string[];
  allMaps: string[];
};

const MODE_LABELS: Record<string, string> = {
  bounty: "Bounty", heist: "Heist", hotZone: "Hot Zone",
  brawlBall: "Brawl Ball", gemGrab: "Gem Grab", knockout: "Knockout",
};
const MODE_EMOJI: Record<string, string> = {
  bounty: "🎯", heist: "💥", hotZone: "🔥", brawlBall: "⚽", gemGrab: "💎", knockout: "☠️",
};
const MODE_COLOR: Record<string, string> = {
  bounty: "#f59e0b", heist: "#ef4444", hotZone: "#f97316",
  brawlBall: "#3b82f6", gemGrab: "#8b5cf6", knockout: "#ec4899",
};

const SOURCE_LABELS = { all: "All Data", matcherino: "Matcherino Only", scrims: "Scrims Only" };

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

const BSC_MAPS: { mode: string; emoji: string; maps: string[] }[] = [
  { mode: "Knockout",  emoji: "☠️", maps: ["Goldarm Gulch", "New Horizons", "Out in the Open"] },
  { mode: "Gem Grab",  emoji: "💎", maps: ["Hard Rock Mine", "Gem Fort", "Crystal Arcade"] },
  { mode: "Brawl Ball",emoji: "⚽", maps: ["Triple Dribble", "Pinhole Punt", "Pinball Dreams"] },
  { mode: "Bounty",    emoji: "🎯", maps: ["Dry Season", "Hideout", "Layer Cake"] },
  { mode: "Heist",     emoji: "💥", maps: ["Pit Stop", "Safe Zone", "Kaboom Canyon"] },
  { mode: "Hot Zone",  emoji: "🔥", maps: ["Ring of Fire", "Open Business", "Dueling Beetles"] },
];

function displayName(name: string) {
  return name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
function getBrawlerImg(brawlerName: string) {
  return `https://cdn.brawlify.com/brawlers/borderless/${brawlerName.toLowerCase().replace(/[\s']/g, "-")}.png`;
}
function wrColor(wr: number) {
  return wr >= 60 ? "text-green-400" : wr >= 50 ? "text-yellow-300" : wr >= 45 ? "text-yellow-500" : "text-red-400";
}
function wrBg(wr: number) {
  return wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : wr >= 45 ? "#f59e0b" : "#ef4444";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0e0e18] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-white/80 mb-1 font-semibold">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color || "#fff" }}>
          {p.name}: {p.value}{typeof p.value === "number" && p.name?.includes("%") ? "" : ""}
        </p>
      ))}
    </div>
  );
};

/* ─── Win Rate by Mode: Card Grid ─────────────────────────────────── */
function ModeCardGrid({ data }: { data: { mode: string; games: number; wins: number; winRate: number }[] }) {
  const byMode = Object.fromEntries(data.map((d) => [d.mode, d]));
  const modes = Object.keys(MODE_LABELS);
  const filled = modes.filter((m) => byMode[m]);
  if (filled.length === 0) return (
    <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">No mode data</div>
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {filled.map((mode) => {
        const d = byMode[mode];
        const wr = d.winRate;
        const color = MODE_COLOR[mode] ?? "#6366f1";
        const losses = d.games - d.wins;
        return (
          <div key={mode} className="bg-black/20 border border-white/6 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">{MODE_EMOJI[mode]}</span>
              <span className="text-[10px] font-mono text-white/60 truncate">{MODE_LABELS[mode]}</span>
            </div>
            <div className="flex items-end justify-between mb-1.5">
              <span className={`text-xl font-black font-mono ${wrColor(wr)}`}>{wr}%</span>
              <span className="text-[10px] font-mono text-white/30">{d.games}g</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${wr}%`, background: wrBg(wr) }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-green-400">{d.wins}W</span>
              <span className="text-[9px] font-mono text-red-400">{losses}L</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Win Rate over Time ─────────────────────────────────────────── */
function TimelineChart({ data }: { data: { date: string; winRate: number; games: number }[] }) {
  if (data.length === 0) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">No timeline data</div>
  );
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
        <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={32} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="winRate" name="Win%" stroke="#22c55e" strokeWidth={2} dot={{ r: 2, fill: "#22c55e" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── Pick/Ban bar chart (pure HTML, so images load reliably) ─────── */
function TopBrawlerBar({ data, color }: { data: { name: string; value: number }[]; color: string; label?: string }) {
  const max = data[0]?.value ?? 1;
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-white/25 w-3 shrink-0">{i + 1}</span>
          <img
            src={getBrawlerImg(d.name)}
            alt={d.name}
            className="w-5 h-5 rounded-full bg-black/30 shrink-0 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-[10px] font-mono text-white/70 w-20 shrink-0 truncate">{displayName(d.name)}</span>
          <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: 1 - i * 0.07 }}
            />
          </div>
          <span className="text-[10px] font-mono shrink-0" style={{ color }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Stat Table ─────────────────────────────────────────────────── */
function SampleDots({ games }: { games: number }) {
  if (games >= 8) return <span title={`${games} games — high confidence`} className="text-[9px] font-mono text-green-400/70 ml-1">●●●</span>;
  if (games >= 4) return <span title={`${games} games — medium confidence`} className="text-[9px] font-mono text-yellow-400/60 ml-1">●●○</span>;
  return <span title={`${games} games — low sample`} className="text-[9px] font-mono text-red-400/50 ml-1">●○○</span>;
}

function StatTable({
  title, icon, rows, cols,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { rank: number; brawler: string; games: number; wr: number; pr?: number }[];
  cols: { key: string; label: string }[];
}) {
  return (
    <div className="bg-card/30 border border-border/40 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card/40">
        {icon}
        <span className="text-xs font-bold font-mono text-foreground/90">{title}</span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/30">●●● = reliable</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="border-b border-border/20 bg-card/20">
              <th className="px-2 py-1.5 text-left text-muted-foreground/60">#</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground/60">Brawler</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-1.5 text-right text-muted-foreground/60">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((r, i) => (
              <tr key={r.brawler + i} className={`border-b border-border/10 hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"} ${r.games < 3 ? "opacity-60" : ""}`}>
                <td className="px-2 py-1 text-muted-foreground/40">{r.rank}</td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <img src={getBrawlerImg(r.brawler)} alt={r.brawler} className="w-5 h-5 rounded-full bg-black/30 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-foreground/90">{displayName(r.brawler)}</span>
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-1 text-right">
                    {c.key === "wr" ? (
                      <span className={`font-semibold ${wrColor(r.wr)}`}>{r.wr}%</span>
                    ) : c.key === "pr" && r.pr !== undefined ? (
                      <span className="text-muted-foreground">{r.pr}%</span>
                    ) : c.key === "games" ? (
                      <span className="inline-flex items-center">
                        <span className={r.games < 3 ? "text-muted-foreground/40" : "text-muted-foreground"}>{r.games}</span>
                        <SampleDots games={r.games} />
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Overview Table ─────────────────────────────────────────────── */
function OverviewTable({ data }: { data: StatsOverview }) {
  const [search, setSearch] = useState("");
  const filtered = data.brawlers.filter((b) => displayName(b.name).toLowerCase().includes(search.toLowerCase())).slice(0, 30);
  return (
    <div className="bg-card/30 border border-border/40 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card/40">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold font-mono">All Brawlers Overview</span>
        <div className="ml-auto relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
          <Input placeholder="Search brawler..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7 font-mono bg-background/50" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="border-b border-border/20 bg-card/20">
              <th className="px-2 py-1.5 text-left text-muted-foreground/60">#</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground/60">Brawler</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground/60">Games</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground/60">Bans</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground/60">Win%</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground/60">PR%</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground/60">W/L</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => (
              <tr key={b.name} className={`border-b border-border/10 hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-2 py-1 text-muted-foreground/40">{i + 1}</td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <img src={getBrawlerImg(b.name)} alt={b.name} className="w-5 h-5 rounded-full bg-black/30 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-foreground/90 font-semibold">{displayName(b.name)}</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-right text-muted-foreground">{b.picks}</td>
                <td className="px-2 py-1 text-right text-red-400/70">{b.bans}</td>
                <td className="px-2 py-1 text-right"><span className={`font-semibold ${wrColor(b.winRate)}`}>{b.winRate}%</span></td>
                <td className="px-2 py-1 text-right text-muted-foreground/70">{b.presence}%</td>
                <td className="px-2 py-1 text-right text-muted-foreground/60">{b.wins}/{b.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Map Analysis View ──────────────────────────────────────────── */
function MapAnalysisView({
  mapName, overview, teamFilters,
}: {
  mapName: string;
  overview: StatsOverview;
  teamFilters: string[];
}) {
  const mode = BSC_MAPS.find((g) => g.maps.includes(mapName));
  const mapImg = MAP_IMAGES[mapName];
  const brawlers = overview.brawlers;
  const totalGames = brawlers.reduce((s, b) => s + b.picks, 0) / 3; // 3 picks per team side

  const topPicks = brawlers
    .slice()
    .sort((a, b) => b.picks - a.picks)
    .slice(0, 8)
    .map((b) => ({ name: b.name, value: b.picks }));

  const topBans = brawlers
    .filter((b) => b.bans > 0)
    .slice()
    .sort((a, b) => b.bans - a.bans)
    .slice(0, 8)
    .map((b) => ({ name: b.name, value: b.bans }));

  const topWR = brawlers
    .filter((b) => b.picks >= 3)
    .slice()
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);

  const mostContested = brawlers
    .slice()
    .sort((a, b) => b.presence - a.presence)
    .slice(0, 5);

  const avgWR = brawlers.length > 0
    ? Math.round(brawlers.reduce((s, b) => s + b.winRate, 0) / brawlers.length * 10) / 10
    : 0;

  return (
    <div className="space-y-5">
      {/* Map header */}
      <div className="relative bg-card/30 border border-border/40 rounded-xl overflow-hidden">
        {mapImg && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: `url(${mapImg})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
          {/* Map full image — visible, contained */}
          {mapImg && (
            <div className="shrink-0 w-32 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden border border-white/15 shadow-lg bg-black/50">
              <img
                src={mapImg}
                alt={mapName}
                className="w-full h-full object-contain"
                onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.style.display = "none"; }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl drop-shadow-lg">{mode?.emoji ?? "🗺️"}</span>
              <div>
                <div className="font-black text-2xl font-mono text-white drop-shadow-md">{mapName}</div>
                <div className="text-xs text-emerald-400 font-mono font-bold tracking-widest uppercase drop-shadow">{mode?.mode ?? "Unknown Mode"}</div>
              </div>
              {teamFilters.length > 0 && (
                <Badge className="ml-auto bg-primary/20 border-primary/40 text-primary text-xs px-3 py-1 backdrop-blur-md">
                  {teamFilters.join(" + ")} stats
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-sm">
              <div className="bg-black/40 backdrop-blur-md rounded-lg p-2.5 text-center border border-white/10">
                <div className="text-xl font-black font-mono text-white">{brawlers.length}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Brawlers</div>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-lg p-2.5 text-center border border-white/10">
                <div className="text-xl font-black font-mono text-emerald-400">{Math.round(totalGames)}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Est. Matches</div>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-lg p-2.5 text-center border border-white/10">
                <div className={`text-xl font-black font-mono ${wrColor(avgWR)}`}>{avgWR}%</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg WR</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Picks & Bans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/30 border border-border/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-blue-400" />
            <p className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wide">Top Picks</p>
          </div>
          {topPicks.length > 0 ? (
            <TopBrawlerBar data={topPicks} color="#3b82f6" label="Picks" />
          ) : (
            <div className="text-xs text-muted-foreground/50 text-center py-6">No pick data</div>
          )}
        </div>
        <div className="bg-card/30 border border-border/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wide">Top Bans</p>
          </div>
          {topBans.length > 0 ? (
            <TopBrawlerBar data={topBans} color="#ef4444" label="Bans" />
          ) : (
            <div className="text-xs text-muted-foreground/50 text-center py-6">No ban data</div>
          )}
        </div>
      </div>

      {/* Best Win Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatTable
          title={`Best Win Rates on ${mapName}`}
          icon={<Star className="w-4 h-4 text-yellow-400" />}
          rows={topWR.map((b, i) => ({ rank: i + 1, brawler: b.name, games: b.picks, wr: b.winRate }))}
          cols={[{ key: "games", label: "Games" }, { key: "wr", label: "WR%" }]}
        />
        <div className="bg-card/30 border border-border/40 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card/40">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold font-mono text-foreground/90">Most Contested</span>
          </div>
          <div className="p-3 space-y-2">
            {mostContested.map((b, i) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/30 w-4">{i + 1}</span>
                <img src={getBrawlerImg(b.name)} alt={b.name} className="w-5 h-5 rounded-full bg-black/30 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{displayName(b.name)}</span>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-blue-400">{b.picks}p</span>
                  <span className="text-red-400/70">{b.bans}b</span>
                  <span className="text-white/40">{b.presence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Brawler Detail View ────────────────────────────────────────── */
function BrawlerDetailView({
  detail, selectedMap, teamFilters, loading,
}: {
  detail: BrawlerDetail;
  selectedMap: string;
  teamFilters: string[];
  loading: boolean;
}) {
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const mapMode = selectedMap ? BSC_MAPS.find((g) => g.maps.includes(selectedMap)) : null;

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <motion.div
        key={detail.name}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/10 via-card/40 to-card/20 border border-primary/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={getBrawlerImg(detail.name)}
              alt={detail.name}
              className="w-20 h-20 rounded-2xl border-2 border-primary/30 bg-black/40 object-cover shadow-xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-2xl font-black font-mono text-foreground">{displayName(detail.name)}</span>
              {selectedMap && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                  {mapMode?.emoji} {selectedMap}
                </Badge>
              )}
              {teamFilters.length > 0 && (
                <Badge className="bg-primary/15 border-primary/30 text-primary text-[10px]">
                  {teamFilters.join(" + ")}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {[
                { label: "Games", value: detail.picks, cls: "text-white" },
                { label: "Win Rate", value: `${detail.winRate}%`, cls: wrColor(detail.winRate) },
                { label: "Bans", value: detail.bans, cls: "text-red-400" },
                { label: "Presence", value: `${detail.presence}%`, cls: "text-muted-foreground" },
                { label: "Record", value: `${detail.wins}W/${detail.losses}L`, cls: "text-muted-foreground" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-black/20 rounded-lg p-2 text-center">
                  <div className={`text-sm font-black font-mono ${cls}`}>{value}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/30 border border-border/40 rounded-lg p-3">
          <p className="text-xs font-bold font-mono text-muted-foreground mb-3 uppercase tracking-wide">
            Win Rate over Time
          </p>
          <TimelineChart data={detail.timeline} />
        </div>
        <div className="bg-card/30 border border-border/40 rounded-lg p-3">
          <p className="text-xs font-bold font-mono text-muted-foreground mb-3 uppercase tracking-wide">
            Win Rate by Mode
          </p>
          <ModeCardGrid data={detail.byMode} />
        </div>
      </div>

      {/* Win/Loss breakdown bar */}
      {detail.picks > 0 && (
        <div className="bg-card/30 border border-border/40 rounded-lg p-3">
          <p className="text-xs font-bold font-mono text-muted-foreground mb-3 uppercase tracking-wide">
            Win / Loss Breakdown
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full overflow-hidden bg-red-500/20 flex">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${detail.winRate}%` }}
              />
            </div>
            <div className="flex gap-3 text-xs font-mono shrink-0">
              <span className="text-green-400">{detail.wins}W ({detail.winRate}%)</span>
              <span className="text-red-400">{detail.losses}L ({Math.round((100 - detail.winRate) * 10) / 10}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Counters & Teammates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatTable
          title={`Counters vs ${displayName(detail.name)}`}
          icon={<Sword className="w-4 h-4 text-red-400" />}
          rows={detail.counters.map((c, i) => ({ rank: i + 1, brawler: c.brawler, games: c.games, wr: c.winRate }))}
          cols={[{ key: "games", label: "Games" }, { key: "wr", label: "WR%" }]}
        />
        <StatTable
          title={`Best Teammates`}
          icon={<Users className="w-4 h-4 text-green-400" />}
          rows={detail.teammates.map((t, i) => ({ rank: i + 1, brawler: t.brawler, games: t.games, wr: t.winRate }))}
          cols={[{ key: "games", label: "Games" }, { key: "wr", label: "WR%" }]}
        />
      </div>
    </div>
  );
}

/* ─── Autocomplete Input ─────────────────────────────────────────── */
function AutocompleteInput({ value, onChange, onSelect, suggestions, placeholder, icon }: {
  value: string; onChange: (v: string) => void; onSelect: (v: string) => void;
  suggestions: string[]; placeholder: string; icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const matches = value.trim().length === 0 ? [] : suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
  useEffect(() => { setOpen(matches.length > 0); }, [matches.length]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 flex items-center">{icon}</span>
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => { if (matches.length > 0) setOpen(true); }} className="h-8 text-xs pl-7 w-40 font-mono bg-background/50" autoComplete="off" />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }} className="absolute top-full mt-1 left-0 z-50 w-56 bg-[#0e0e18] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            {matches.map((m) => (
              <button key={m} onMouseDown={(e) => { e.preventDefault(); onSelect(m); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs font-mono text-foreground/80 hover:bg-white/[0.06] hover:text-foreground transition-colors truncate">
                {m}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Recorded Games ─────────────────────────────────────────────── */

/* ─── Compact game list row (click → opens panel) ────────────────── */
function GameListRow({ game, onOpen, isOpen }: { game: GameRecord; onOpen: () => void; isOpen: boolean; key?: any }) {
  const t1Won = game.winner === "team1";
  const t2Won = game.winner === "team2";
  return (
    <button onClick={onOpen}
      className={`w-full text-left border rounded-xl bg-card/20 hover:bg-card/30 transition-all overflow-hidden ${
        isOpen ? "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_rgb(var(--primary)/0.2)]" : "border-border/40 hover:border-border/60"
      }`}>
      {/* Mode / map / source */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20 bg-black/30">
        <span className="text-sm">{MODE_EMOJI[game.mode] ?? "🎮"}</span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest shrink-0">{MODE_LABELS[game.mode] ?? game.mode}</span>
        <span className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded font-bold truncate">{game.map}</span>
        <Badge variant="outline" className={`text-[8px] font-mono h-4 px-1 ml-auto shrink-0 ${game.source === "scrim" ? "border-orange-600/40 text-orange-400" : "border-blue-600/40 text-blue-400"}`}>
          {game.source === "scrim" ? "Scrim" : "Matcherino"}
        </Badge>
      </div>
      {/* Teams + players */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-1 px-3 py-2.5 items-start">
        <div className={`min-w-0 ${game.winner && !t1Won ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-1">
            <span className={`text-[11px] font-black font-mono truncate ${t1Won ? "text-green-400" : "text-foreground"}`}>{game.team1Name}</span>
            {t1Won && <span className="text-[8px] text-green-400 font-mono shrink-0">W</span>}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            {game.team1Picks.map((p, i) => p.player && (
              <span key={i} className="text-[8px] font-mono text-muted-foreground/50 truncate leading-tight">
                {p.player.replace(/^[A-Z0-9]{2,8}\|/i, "")}
              </span>
            ))}
          </div>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/40 px-1 pt-0.5">{game.score || "vs"}</span>
        <div className={`min-w-0 ${game.winner && !t2Won ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-1 justify-end">
            {t2Won && <span className="text-[8px] text-green-400 font-mono shrink-0">W</span>}
            <span className={`text-[11px] font-black font-mono truncate text-right ${t2Won ? "text-green-400" : "text-foreground"}`}>{game.team2Name}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-1 items-end">
            {game.team2Picks.map((p, i) => p.player && (
              <span key={i} className="text-[8px] font-mono text-muted-foreground/50 truncate leading-tight">
                {p.player.replace(/^[A-Z0-9]{2,8}\|/i, "")}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Pick preview */}
      <div className="flex items-center justify-center gap-2 px-3 pb-2.5">
        <div className="flex gap-0.5">
          {game.team1Picks.slice(0, 3).map((p, i) => (
            <img key={i} src={getBrawlerImg(p.brawler)} alt={p.brawler} className="w-5 h-5 rounded-full bg-black/40 border border-white/10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ))}
        </div>
        <span className="text-[8px] text-muted-foreground/25 font-mono">vs</span>
        <div className="flex gap-0.5">
          {game.team2Picks.slice(0, 3).map((p, i) => (
            <img key={i} src={getBrawlerImg(p.brawler)} alt={p.brawler} className="w-5 h-5 rounded-full bg-black/40 border border-white/10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ))}
        </div>
      </div>
    </button>
  );
}


function GamesSection({ games, loading, onOpenPanel, openPanelKeys, allMatcherinoRounds, sourceFilter, setSourceFilter }: {
  games: GameRecord[];
  loading: boolean;
  onOpenPanel: (game: GameRecord) => void;
  openPanelKeys: Set<string>;
  allMatcherinoRounds: string[];
  sourceFilter: "all" | "scrim" | "matcherino";
  setSourceFilter: (v: "all" | "scrim" | "matcherino") => void;
}) {
  const [open, setOpen] = useState(false);
  const [roundsFilter, setRoundsFilter] = useState<string[]>([]);
  const [roundsOpen, setRoundsOpen] = useState(false);

  useEffect(() => {
    if (sourceFilter !== "matcherino") setRoundsFilter([]);
  }, [sourceFilter]);

  const filtered = useMemo(() => {
    return games.filter((g) => {
      if (sourceFilter !== "all" && g.source !== (sourceFilter === "scrim" ? "scrim" : "matcherino")) return false;
      if (roundsFilter.length > 0) {
        if (g.source !== "matcherino" || !g.roundName || !roundsFilter.includes(g.roundName)) return false;
      }
      return true;
    });
  }, [games, sourceFilter, roundsFilter]);

  const hasNoDataForRound = roundsFilter.length > 0 && filtered.length === 0;

  function toggleRound(r: string) {
    setRoundsFilter((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleSource(s: "scrim" | "matcherino") {
    setSourceFilter(sourceFilter === s ? "all" : s);
  }

  const sourceColors = {
    scrim: "bg-orange-500/15 border-orange-500/40 text-orange-300",
    matcherino: "bg-blue-500/15 border-blue-500/40 text-blue-300",
  };
  const inactiveBtn = "bg-transparent border-border/20 text-muted-foreground/50 hover:text-muted-foreground";

  return (
    <div className="bg-card/30 border border-border/40 rounded-xl overflow-hidden">
      {/* Section toggle */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold font-mono text-foreground/90 uppercase tracking-wide">Recorded Games</span>
          <Badge variant="outline" className="text-[9px] font-mono h-4 px-1.5 border-border/40 text-muted-foreground">
            {loading ? "…" : `${filtered.length}${filtered.length !== games.length ? `/${games.length}` : ""}`}
          </Badge>
          {openPanelKeys.size > 0 && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-mono h-4 px-1.5">
              {openPanelKeys.size} open
            </Badge>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/30">
            <div className="p-4 space-y-3">

              {/* ── Source + Rounds filters ── */}
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                {/* Source toggle buttons — click active to deselect (→ show all) */}
                <div className="flex gap-1">
                  {(["scrim", "matcherino"] as const).map((s) => (
                    <button key={s} onClick={() => toggleSource(s)}
                      className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${
                        sourceFilter === s ? sourceColors[s] : inactiveBtn
                      }`}>
                      {s === "scrim" ? "Scrim" : "Matcherino"}
                    </button>
                  ))}
                </div>

                {/* Rounds filter — only visible when Matcherino is selected */}
                {sourceFilter === "matcherino" && allMatcherinoRounds.length > 0 && (
                  <div className="relative">
                    <button onClick={() => setRoundsOpen(o => !o)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${
                        roundsFilter.length > 0 ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : inactiveBtn
                      }`}>
                      Rounds {roundsFilter.length > 0 && `(${roundsFilter.length})`}
                      <ChevronDown className={`w-3 h-3 transition-transform ${roundsOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {roundsOpen && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
                          className="absolute top-full mt-1 left-0 z-20 bg-card/95 border border-border/60 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md min-w-[180px]">
                          {allMatcherinoRounds.map((r) => (
                            <button key={r} onClick={() => toggleRound(r)}
                              className="w-full text-left px-3 py-2 text-[10px] font-mono flex items-center gap-2 hover:bg-white/[0.08] transition-colors border-b border-border/20 last:border-0">
                              <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                roundsFilter.includes(r) ? "bg-blue-500/80 border-blue-400" : "border-border/50"
                              }`}>
                                {roundsFilter.includes(r) && <span className="text-[7px] text-white font-bold">✓</span>}
                              </div>
                              <span className="truncate text-foreground/80">{r}</span>
                            </button>
                          ))}
                          {roundsFilter.length > 0 && (
                            <button onClick={() => setRoundsFilter([])}
                              className="w-full text-left px-3 py-2 text-[9px] font-mono text-red-400/70 hover:text-red-400 transition-colors hover:bg-white/5">
                              Clear
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {roundsFilter.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-mono">
                    {r}
                    <button onClick={() => toggleRound(r)} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>

              {/* ── No data for round warning ── */}
              {hasNoDataForRound && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] font-mono text-red-300">
                  <span className="text-base shrink-0">⚠️</span>
                  No games found for {roundsFilter.length === 1 ? `round "${roundsFilter[0]}"` : "the selected rounds"} with the current brawler/map filter.
                </div>
              )}

              {/* ── Games list ── */}
              {loading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : !hasNoDataForRound && filtered.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground/50 font-mono border border-dashed border-border/30 rounded-lg">
                  No recorded games match current filters
                </div>
              ) : !hasNoDataForRound ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((g) => (
                    <GameListRow key={g.id} game={g}
                      onOpen={() => onOpenPanel(g)}
                      isOpen={openPanelKeys.has(seriesKey(g))} />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Filter Chip ────────────────────────────────────────────────── */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void; key?: any }) {
  return (
    <motion.span initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.12 }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-mono font-semibold">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors ml-0.5" aria-label={`Remove ${label}`}><X className="w-3 h-3" /></button>
    </motion.span>
  );
}

/* ─── Date Range Filter ──────────────────────────────────────────── */
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function DateRangeFilter({ from, to, onChange }: {
  from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const range: DateRange | undefined = from ? { from: new Date(from + "T00:00:00"), to: to ? new Date(to + "T00:00:00") : undefined } : undefined;
  const hasRange = !!from;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs font-mono border-border/50 gap-1.5 ${hasRange ? "border-primary/40 text-primary" : ""}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {hasRange ? `${fmtDateShort(from)} – ${to ? fmtDateShort(to) : "…"}` : "Date range"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          onSelect={(r: DateRange | undefined) => {
            onChange(r?.from ? fmtDate(r.from) : null, r?.to ? fmtDate(r.to) : null);
          }}
          defaultMonth={range?.from}
        />
        {hasRange && (
          <div className="flex justify-end p-2 border-t border-border/30">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] font-mono text-muted-foreground" onClick={() => { onChange(null, null); setPopoverOpen(false); }}>
              Clear range
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function MapsPage() {
  const [source, setSource] = useState<"all" | "matcherino" | "scrims">("all");
  const [selectedBrawler, setSelectedBrawler] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<string>("");
  const [teamInput, setTeamInput] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [playerFilters, setPlayerFilters] = useState<string[]>([]);
  const [modeFilter, setModeFilter] = useState("ALL");
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [detail, setDetail] = useState<BrawlerDetail | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [brawlerSearch, setBrawlerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [allTeams, setAllTeams] = useState<string[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);


  /* ── Global panel context ── */
  const { openPanel: globalOpenPanel, openPanelKeys } = useGamePanel();
  const [, navigate] = useLocation();

  function openPanel(game: GameRecord) {
    globalOpenPanel(game, selectedBrawler, selectedMap);
    navigate("/match");
  }

  /* ── Source filter for Recorded Games (lifted so panel can react to it) ── */
  const [gamesSourceFilter, setGamesSourceFilter] = useState<"all" | "scrim" | "matcherino">("all");

  /* ── All matcherino rounds (independent of brawler/map filter) ── */
  const [allMatcherinoRounds, setAllMatcherinoRounds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then((d) => { setAllPlayers(d.players ?? []); setAllTeams(d.teams ?? []); }).catch(() => {});
  }, []);

  const teamFiltersKey = JSON.stringify([...teamFilters].sort());
  const playerFiltersKey = JSON.stringify([...playerFilters].sort());

  useEffect(() => { fetchOverview(); }, [source, teamFiltersKey, playerFiltersKey, modeFilter, selectedMap, dateFrom, dateTo]);
  useEffect(() => {
    if (selectedBrawler) fetchDetail(selectedBrawler);
    else setDetail(null);
  }, [selectedBrawler, source, teamFiltersKey, playerFiltersKey, modeFilter, selectedMap, dateFrom, dateTo]);
  useEffect(() => {
    if (selectedBrawler || selectedMap) fetchGames();
    else setGames([]);
  }, [selectedBrawler, selectedMap, source, teamFiltersKey, playerFiltersKey, modeFilter, dateFrom, dateTo]);

  /* Fetch ALL matcherino rounds (ignoring brawler/map) so the round dropdown is always complete */
  useEffect(() => {
    async function fetchAllRounds() {
      try {
        const params = new URLSearchParams({ source: "matcherino" });
        if (teamFilters.length > 0) params.set("team", teamFilters.join(","));
        if (playerFilters.length > 0) params.set("player", playerFilters.join(","));
        if (modeFilter !== "ALL") params.set("mode", modeFilter);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        const r = await fetch(`/api/brawler-stats/games?${params}`);
        const data = await r.json();
        const allG: GameRecord[] = Array.isArray(data?.games) ? data.games : [];
        const rounds = [...new Set(allG.map(g => g.roundName).filter(Boolean) as string[])].sort();
        setAllMatcherinoRounds(rounds);
      } catch { setAllMatcherinoRounds([]); }
    }
    fetchAllRounds();
  }, [teamFiltersKey, playerFiltersKey, modeFilter, dateFrom, dateTo]);

  /* ── Panel functions ── */

  function buildParams() {
    const params = new URLSearchParams({ source });
    if (teamFilters.length > 0) params.set("team", teamFilters.join(","));
    if (playerFilters.length > 0) params.set("player", playerFilters.join(","));
    if (modeFilter !== "ALL") params.set("mode", modeFilter);
    if (selectedMap) params.set("map", selectedMap);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  }

  async function fetchOverview() {
    setLoadingOverview(true); setError(null);
    try {
      const r = await fetch(`/api/brawler-stats?${buildParams()}`);
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      setOverview(await r.json());
    } catch (e: any) { setError(e.message ?? "Failed to load data"); }
    finally { setLoadingOverview(false); }
  }

  async function fetchDetail(brawler: string) {
    setLoadingDetail(true); setError(null); setDetail(null);
    try {
      const params = buildParams(); params.set("brawler", brawler);
      const r = await fetch(`/api/brawler-stats?${params}`);
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      setDetail(await r.json());
    } catch (e: any) { setError(e.message ?? "Failed to load data"); setDetail(null); }
    finally { setLoadingDetail(false); }
  }

  async function fetchGames() {
    setLoadingGames(true);
    try {
      const params = buildParams();
      if (selectedBrawler) params.set("brawler", selectedBrawler);
      const r = await fetch(`/api/brawler-stats/games?${params}`);
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      setGames(Array.isArray(data?.games) ? data.games : []);
    } catch {
      setGames([]);
    } finally {
      setLoadingGames(false);
    }
  }

  function applyTeam(v: string) { setTeamInput(""); setTeamFilters((p) => p.includes(v) ? p : [...p, v]); }
  function applyPlayer(v: string) { setPlayerInput(""); setPlayerFilters((p) => p.includes(v) ? p : [...p, v]); }
  function removeTeam(v: string) { setTeamFilters((p) => p.filter((t) => t !== v)); }
  function removePlayer(v: string) { setPlayerFilters((p) => p.filter((pl) => pl !== v)); }

  const filteredBrawlers = (overview?.allBrawlers ?? []).filter((b) =>
    displayName(b).toLowerCase().includes(brawlerSearch.toLowerCase())
  );
  const activeMapMode = selectedMap ? BSC_MAPS.find((g) => g.maps.includes(selectedMap)) : null;
  const hasActiveFilters = teamFilters.length > 0 || playerFilters.length > 0 || modeFilter !== "ALL" || !!selectedMap || !!dateFrom;

  /* Determine view scenario */
  const scenario: "brawler" | "map" | "overview" =
    selectedBrawler ? "brawler" : selectedMap ? "map" : "overview";

  return (
    <div className="min-h-screen w-full">
      {/* Sticky Header */}
      <div className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <Map className="w-5 h-5 text-emerald-400" />
            <span className="font-bold font-mono text-lg tracking-tight">BSC Maps & Brawlers</span>
            {selectedMap && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                {activeMapMode?.emoji} {selectedMap}
              </Badge>
            )}
            {selectedBrawler && (
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] flex items-center gap-1">
                <img src={getBrawlerImg(selectedBrawler)} className="w-3.5 h-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {displayName(selectedBrawler)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
            <Select value={source} onValueChange={(v: any) => setSource(v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-mono border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(SOURCE_LABELS).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}</SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs font-mono border-border/50"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Modes</SelectItem>
                {Object.entries(MODE_LABELS).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}
              </SelectContent>
            </Select>
            <AutocompleteInput value={teamInput} onChange={setTeamInput} onSelect={applyTeam} suggestions={allTeams} placeholder="Add team filter..." icon={<Users className="w-3 h-3" />} />
            <AutocompleteInput value={playerInput} onChange={setPlayerInput} onSelect={applyPlayer} suggestions={allPlayers} placeholder="Add player filter..." icon={<Search className="w-3 h-3" />} />
          </div>
        </div>
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="max-w-7xl mx-auto px-4 pb-2 flex flex-wrap gap-2 items-center overflow-hidden">
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mr-1">Active:</span>
              <AnimatePresence>
                {teamFilters.map((t) => <FilterChip key={`team-${t}`} label={`Team: ${t}`} onRemove={() => removeTeam(t)} />)}
                {playerFilters.map((p) => <FilterChip key={`player-${p}`} label={`Player: ${p}`} onRemove={() => removePlayer(p)} />)}
                {modeFilter !== "ALL" && <FilterChip key="mode" label={`Mode: ${MODE_LABELS[modeFilter] ?? modeFilter}`} onRemove={() => setModeFilter("ALL")} />}
                {selectedMap && <FilterChip key="map" label={`Map: ${selectedMap}`} onRemove={() => setSelectedMap("")} />}
                {dateFrom && <FilterChip key="date" label={`Date: ${fmtDateShort(dateFrom)}${dateTo ? " – " + fmtDateShort(dateTo) : ""}`} onRemove={() => { setDateFrom(null); setDateTo(null); }} />}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Match detail panels — own area between header and main grid ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* Left Sidebar */}
          <div className="space-y-4">
            {/* Brawler Selector */}
            <div className="bg-card/30 border border-border/40 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border/30 bg-card/40">
                <p className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wide">Select Brawler</p>
              </div>
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                  <Input placeholder="Search..." value={brawlerSearch} onChange={(e) => setBrawlerSearch(e.target.value)} className="h-7 text-xs pl-7 font-mono bg-background/50" />
                </div>
                <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                  <button
                    className={`w-full text-left px-2 py-1 rounded text-xs font-mono transition-colors ${!selectedBrawler ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                    onClick={() => setSelectedBrawler(null)}
                  >All Brawlers</button>
                  {filteredBrawlers.map((b) => (
                    <button
                      key={b}
                      className={`w-full text-left px-2 py-1 rounded text-xs font-mono transition-colors flex items-center gap-2 ${selectedBrawler === b ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-foreground/80 hover:bg-white/5"}`}
                      onClick={() => setSelectedBrawler(selectedBrawler === b ? null : b)}
                    >
                      <img src={getBrawlerImg(b)} alt={b} className="w-5 h-5 rounded-full bg-black/30 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {displayName(b)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Selector */}
            <div className="bg-card/30 border border-border/40 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border/30 bg-card/40">
                <p className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wide">Select Map</p>
              </div>
              <div className="p-2 space-y-3 max-h-[400px] overflow-y-auto">
                <button
                  className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${!selectedMap ? "bg-emerald-900/30 text-emerald-400" : "text-muted-foreground hover:bg-white/5"}`}
                  onClick={() => setSelectedMap("")}
                >All Maps</button>
                {BSC_MAPS.map((group) => (
                  <div key={group.mode} className="space-y-1.5">
                    <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest px-1 flex items-center gap-1">{group.emoji} {group.mode}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {group.maps.map((m) => {
                        const mapImg = MAP_IMAGES[m];
                        return (
                          <button
                            key={m}
                            className={`relative w-full text-left rounded-xl overflow-hidden transition-all group h-16 ${selectedMap === m ? "ring-2 ring-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.25)]" : "border border-white/8 hover:border-white/25"}`}
                            onClick={() => setSelectedMap(selectedMap === m ? "" : m)}
                          >
                            {mapImg ? (
                              <img src={mapImg} alt={m} className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:opacity-70 transition-opacity" />
                            ) : (
                              <div className="absolute inset-0 bg-black/40" />
                            )}
                            <div className={`absolute inset-0 bg-gradient-to-r ${selectedMap === m ? "from-emerald-950/85 to-black/20" : "from-black/75 to-black/10"}`} />
                            <div className="relative z-10 px-3 flex items-center h-full gap-2">
                              <span className="text-base">{group.emoji}</span>
                              <span className={`text-xs font-mono font-bold leading-tight ${selectedMap === m ? "text-emerald-300" : "text-white/90"}`}>{m}</span>
                              {selectedMap === m && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Context hint */}
            {(teamFilters.length > 0 || selectedMap || selectedBrawler) && (
              <div className="bg-card/20 border border-border/20 rounded-lg p-3 text-[10px] font-mono text-muted-foreground/50 space-y-1">
                <p className="uppercase tracking-wider text-muted-foreground/40 mb-1">Current scope</p>
                {teamFilters.length > 0 && <p>🏷️ Team: {teamFilters.join(", ")}</p>}
                {selectedMap && <p>{activeMapMode?.emoji} Map: {selectedMap}</p>}
                {selectedBrawler && <p>🎮 Brawler: {displayName(selectedBrawler)}</p>}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-5">
            {error ? (
              <div className="flex items-center justify-center py-24 text-red-400 font-mono text-sm">⚠️ {error}</div>
            ) : (loadingOverview && scenario !== "brawler") || (loadingDetail && scenario === "brawler") ? (
              <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : scenario === "brawler" ? (
              detail ? (
                <BrawlerDetailView
                  detail={detail}
                  selectedMap={selectedMap}
                  teamFilters={teamFilters}
                  loading={loadingDetail}
                />
              ) : loadingDetail ? (
                <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="flex items-center justify-center py-24 text-muted-foreground text-sm font-mono">No data for this brawler with current filters</div>
              )
            ) : scenario === "map" && overview ? (
              <MapAnalysisView mapName={selectedMap} overview={overview} teamFilters={teamFilters} />
            ) : overview && overview.brawlers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <div className="text-5xl select-none">🔍</div>
                <div className="font-mono text-sm font-semibold text-foreground/70">No data for current filters</div>
                <div className="text-xs text-muted-foreground/50">Try adjusting or removing some filters</div>
              </div>
            ) : overview ? (
              <OverviewTable data={overview} />
            ) : null}

            {(selectedBrawler || selectedMap) && !error && (
              <GamesSection
                games={games}
                loading={loadingGames}
                onOpenPanel={openPanel}
                openPanelKeys={openPanelKeys}
                allMatcherinoRounds={allMatcherinoRounds}
                sourceFilter={gamesSourceFilter}
                setSourceFilter={setGamesSourceFilter}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

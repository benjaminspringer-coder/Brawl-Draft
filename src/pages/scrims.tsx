import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ChevronLeft, ChevronRight, Filter, Swords, ChevronDown, Star, Calendar, TrendingUp, Info, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MAP_IMAGES, MODE_ICONS, MODE_LABELS, getBrawlerImgById } from "@/lib/brawl-constants";

type ScrimPlayer = { name: string; brawler: string; brawlerId: number; tag: string; country: string; isSubstitute: boolean };
type Scrim = {
  id: number; scrimId: string; time: string; mode: string; map: string;
  duration: number | null; scoreline: string | null; winnerTeamCode: string | null;
  isTournament: boolean; team1Code: string | null; team1Name: string | null;
  team2Code: string | null; team2Name: string | null;
  team1Players: ScrimPlayer[]; team2Players: ScrimPlayer[];
  mvpPlayer: string | null; mvpTeam: string | null;
  region: string;
};
type TeamLogos = Record<string, string>;

type RegionKey = "EMEA" | "NA" | "SA" | "EA";

const REGION_TAB_META: Record<RegionKey, { label: string; icon: string; color: string; badgeBg: string }> = {
  EMEA: { label: "EMEA",      icon: "🇪🇺", color: "text-blue-400",  badgeBg: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  NA:   { label: "NA",        icon: "🇺🇸", color: "text-red-400",   badgeBg: "bg-red-500/20 text-red-400 border-red-500/40" },
  SA:   { label: "SA",        icon: "🌎", color: "text-green-400", badgeBg: "bg-green-500/20 text-green-400 border-green-500/40" },
  EA:   { label: "EA / APAC", icon: "🌏", color: "text-rose-400",  badgeBg: "bg-rose-500/20 text-rose-400 border-rose-500/40" },
};

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function TeamLogo({ code, logos }: { code: string | null; logos: TeamLogos }) {
  const url = code ? logos[code] : undefined;
  if (!url) return null;
  return (
    <img src={url} alt={code ?? ""} className="w-8 h-8 object-contain rounded shrink-0"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  );
}

function getTeamLabel(code: string | null, name: string | null, players: ScrimPlayer[]): string {
  if (name) return name;
  if (code) return code;
  if (players.length > 0) return players.map(p => p.name.replace(/^[A-Z0-9]+\|/, "")).join(" / ");
  return "?";
}

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='6' fill='%23ffffff08'/%3E%3C/svg%3E";

function PlayerRow({ player, won, reversed = false }: { player: ScrimPlayer; won: boolean; reversed?: boolean; key?: any }) {
  return (
    <div className={`flex items-center gap-2 py-1 ${player.isSubstitute ? "opacity-50" : ""} ${reversed ? "flex-row-reverse" : ""}`}>
      <img
        src={getBrawlerImgById(player.brawlerId)}
        alt={player.brawler}
        className={`w-7 h-7 rounded-lg border flex-shrink-0 bg-black/60 object-contain shadow-sm ${won ? "border-green-500/40" : "border-white/10"}`}
        onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = FALLBACK_IMG; }}
      />
      <div className={`min-w-0 ${reversed ? "text-right" : ""}`}>
        <div className="text-[10px] font-mono font-bold text-foreground/90 truncate max-w-[90px]">
          {player.name.replace(/^[A-Z0-9]+\|/i, "")}
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wide truncate max-w-[90px]">
          {player.brawler}
        </div>
      </div>
      {player.isSubstitute && <span className="text-[7px] text-yellow-500/70 font-mono border border-yellow-500/20 px-1 rounded shrink-0">SUB</span>}
    </div>
  );
}

function ScrimCard({ scrim, mapIndex }: { scrim: Scrim; mapIndex: number; key?: any }) {
  const t1Won = scrim.winnerTeamCode === scrim.team1Code;
  const t2Won = scrim.winnerTeamCode === scrim.team2Code;
  const mapImage = MAP_IMAGES[scrim.map];
  const modeIcon = MODE_ICONS[scrim.mode] ?? "🎮";
  const modeLabel = MODE_LABELS[scrim.mode] ?? scrim.mode;
  const regMeta = REGION_TAB_META[scrim.region as RegionKey] ?? REGION_TAB_META.EMEA;

  return (
    <div className="border border-border/40 rounded-2xl bg-card/30 hover:bg-card/50 hover:border-border/60 transition-all overflow-hidden shadow-sm flex flex-col">

      {/* Top bar: time + mode + region badge */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-black/30">
        <div className="flex items-center gap-2">
          {scrim.isTournament && (
            <Badge variant="outline" className="text-[8px] font-mono font-bold uppercase h-4 border-yellow-500/40 text-yellow-400 px-1.5 bg-yellow-500/10">
              Tourney
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground/70 font-mono">{formatTime(scrim.time)}</span>
          <Badge className={`text-[8px] font-mono font-bold px-1.5 h-4 uppercase border ${regMeta.badgeBg}`}>
            {regMeta.icon} {scrim.region}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-muted-foreground/80">
          <span>{modeIcon}</span>
          <span className="uppercase tracking-widest">{modeLabel}</span>
        </div>
      </div>

      {/* Main: 3-column — left team | map center | right team */}
      <div className="grid grid-cols-[1fr_100px_1fr] flex-1">

        {/* Team 1 — left */}
        <div className={`flex flex-col p-3 gap-1 ${!t1Won && scrim.winnerTeamCode ? "opacity-40" : ""}`}>
          <div className="flex items-center gap-1 mb-1">
            <span className={`text-[10px] font-black font-mono tracking-tight line-clamp-1 ${t1Won ? "text-green-400" : "text-foreground/80"}`}>
              {getTeamLabel(scrim.team1Code, scrim.team1Name, scrim.team1Players ?? [])}
            </span>
            {t1Won && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[7px] font-mono px-1 h-3 shrink-0">W</Badge>}
          </div>
          <div className="space-y-0">
            {(scrim.team1Players ?? []).map((p, i) => <PlayerRow key={i} player={p} won={t1Won} />)}
          </div>
        </div>

        {/* Center — map image full + score */}
        <div className="flex flex-col border-x border-border/20 bg-black/30">
          <div className="relative flex-1 min-h-[80px] overflow-hidden">
            {mapImage ? (
              <img
                src={mapImage}
                alt={scrim.map}
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = FALLBACK_IMG; }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-30">{modeIcon}</div>
            )}
          </div>
          <div className="border-t border-border/20 bg-black/40 px-1 py-1.5 text-center">
            <div className="text-[8px] font-mono text-muted-foreground/50 truncate leading-tight">{scrim.map}</div>
            {scrim.scoreline && (
              <div className="text-sm font-black font-mono text-white leading-tight mt-0.5">{scrim.scoreline}</div>
            )}
          </div>
        </div>

        {/* Team 2 — right */}
        <div className={`flex flex-col p-3 gap-1 items-end ${!t2Won && scrim.winnerTeamCode ? "opacity-40" : ""}`}>
          <div className="flex items-center gap-1 mb-1 justify-end">
            {t2Won && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[7px] font-mono px-1 h-3 shrink-0">W</Badge>}
            <span className={`text-[10px] font-black font-mono tracking-tight line-clamp-1 text-right ${t2Won ? "text-green-400" : "text-foreground/80"}`}>
              {getTeamLabel(scrim.team2Code, scrim.team2Name, scrim.team2Players ?? [])}
            </span>
          </div>
          <div className="space-y-0 w-full">
            {(scrim.team2Players ?? []).map((p, i) => <PlayerRow key={i} player={p} won={t2Won} reversed />)}
          </div>
        </div>
      </div>

      {/* MVP footer */}
      {scrim.mvpPlayer && (
        <div className="px-3 py-1.5 border-t border-border/20 bg-yellow-500/5 text-[9px] text-yellow-500/80 font-mono font-bold uppercase tracking-widest flex items-center gap-1">
          <Star className="w-2.5 h-2.5 text-yellow-500" /> MVP: <span className="text-yellow-400">{scrim.mvpPlayer}</span>
        </div>
      )}
    </div>
  );
}

function MatchupRow({ t1Code, t1Name, t2Code, t2Name, maps, logos }: {
  t1Code: string | null; t1Name: string | null;
  t2Code: string | null; t2Name: string | null;
  maps: Scrim[]; logos: TeamLogos; key?: any;
}) {
  const [open, setOpen] = useState(false);
  const t1Wins = maps.filter(s => s.winnerTeamCode === t1Code).length;
  const t2Wins = maps.filter(s => s.winnerTeamCode === t2Code).length;
  const winner = t1Wins > t2Wins ? "t1" : t2Wins > t1Wins ? "t2" : null;
  const t1Label = getTeamLabel(t1Code, t1Name, maps[0]?.team1Players ?? []);
  const t2Label = getTeamLabel(t2Code, t2Name, maps[0]?.team2Players ?? []);
  const t2IsUnknown = !t2Code && !t2Name;

  const modesSummary = [...new Set(maps.map(m => MODE_ICONS[m.mode] ?? "🎮"))].join(" ");
  const regionBadge = maps[0]?.region ?? "EMEA";
  const regMeta = REGION_TAB_META[regionBadge as RegionKey] ?? REGION_TAB_META.EMEA;

  return (
    <div className="border border-border/40 rounded-2xl overflow-hidden bg-card/20 hover:bg-card/30 transition-colors shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Team 1 */}
        <div className={`flex items-center gap-3 flex-1 min-w-0 ${winner === "t2" ? "opacity-40" : ""}`}>
          <TeamLogo code={t1Code} logos={logos} />
          <span className={`font-black font-mono tracking-tight truncate text-base sm:text-lg ${winner === "t1" ? "text-green-400" : "text-foreground"}`}>
            {t1Label}
          </span>
          {winner === "t1" && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.3)]">WIN</Badge>
          )}
        </div>

        {/* Score */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-2 bg-black/50 px-4 py-1.5 rounded-xl border border-border/40 shadow-inner">
            <span className={`text-2xl font-black font-mono ${winner === "t1" ? "text-green-400" : "text-foreground/80"}`}>{t1Wins}</span>
            <span className="text-muted-foreground/30 font-mono px-0.5">—</span>
            <span className={`text-2xl font-black font-mono ${winner === "t2" ? "text-green-400" : "text-foreground/80"}`}>{t2Wins}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-mono text-muted-foreground/40 tracking-widest">{modesSummary}</span>
            <Badge className={`text-[8px] font-mono px-1 py-0 h-3 border ${regMeta.badgeBg}`}>
              {regMeta.icon} {regionBadge}
            </Badge>
          </div>
        </div>

        {/* Team 2 */}
        <div className={`flex items-center gap-3 flex-1 min-w-0 justify-end ${winner === "t1" ? "opacity-40" : ""}`}>
          {winner === "t2" && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px] font-mono font-bold px-1.5 py-0 h-4 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.3)]">WIN</Badge>
          )}
          <span className={`font-black font-mono tracking-tight truncate text-base sm:text-lg text-right ${winner === "t2" ? "text-green-400" : t2IsUnknown ? "text-muted-foreground/40" : "text-foreground"}`}>
            {t2Label}
          </span>
          {!t2IsUnknown && <TeamLogo code={t2Code} logos={logos} />}
        </div>

        {/* Expand */}
        <div className="flex items-center gap-2 shrink-0 ml-2 pl-4 border-l border-border/30">
          <span className="text-[10px] font-mono text-muted-foreground/60 font-bold">{maps.length} maps</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border/30 bg-black/15"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 md:p-5">
              {maps.map((scrim, i) => <ScrimCard key={scrim.id} scrim={scrim} mapIndex={i} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PRO_TEAM_RANKS: Record<string, number> = {
  // EMEA
  FUT: 1, HMB: 2, TTM: 3, TOTEM: 3, NAVI: 4, NOVO: 5, KUMA: 6, TH: 7, HERETICS: 7,
  BIG: 8, MZP: 9, METIZPORT: 9, MAD: 10, MADRID: 10, SK: 11, FUT_ACADEMY: 12, KBP: 13,
  FNRS: 14, ZEN: 15, ZENITH: 15, WW: 16, AQL: 17, AQUILA: 17, SXS: 18, CGO: 19,
  BIZZA: 20, TGRB: 21, "2012": 22, SLC: 23, REV: 24,

  // NA
  TRIBE: 1, TRB: 1, TE: 2, ELEKTROS: 2, BOB: 3, VTC: 4, VATIC: 4, NOVA: 5,
  VIC: 6, HML: 7, HOMELESS: 7, LGCY: 8, LEGACY: 8, UN: 9, UTOPIA: 9, LG: 10,
  SSG: 11, KCP: 12, STK: 13, MST: 14, NAME: 15, MTM: 16, KDS: 17,

  // SA
  BH: 1, PCNG: 2, LOUD: 3, OS: 4, SKCSA: 5, RCD: 6, RED: 6, OCXD: 7, ZRT: 8, AL: 9, CB: 10,

  // EA / APAC
  ZETA: 1, CR: 2, RVL: 3, RIVAL: 3, SKC: 4, FL: 5, FENNEL: 5, IGM: 6, IGNUM: 6,
  INS: 7, INSOMNIA: 7, RC: 8, REJECT: 8, FZ: 9, AXIS: 10,
};

function getTeamScore(code?: string | null, name?: string | null, players?: any[]): number {
  if (code) {
    const uc = code.toUpperCase().trim();
    if (PRO_TEAM_RANKS[uc]) return 2000 - PRO_TEAM_RANKS[uc];
  }

  if (name) {
    const un = name.toUpperCase().trim();
    for (const [key, rank] of Object.entries(PRO_TEAM_RANKS)) {
      if (un.includes(key)) return 2000 - rank;
    }
  }

  if (players && Array.isArray(players)) {
    for (const p of players) {
      if (p?.name && typeof p.name === "string") {
        const pUpper = p.name.toUpperCase();
        for (const [key, rank] of Object.entries(PRO_TEAM_RANKS)) {
          if (pUpper.startsWith(key + "|") || pUpper.startsWith(key + " |") || pUpper.includes(key)) {
            return 2000 - rank;
          }
        }
      }
    }
  }

  if (code && code.trim().length >= 2) return 100;
  if (name && name.trim().length >= 2) return 80;

  return 0;
}

function getMatchupScore(maps: Scrim[]): number {
  const first = maps[0];
  const t1Code = first?.team1Code;
  const t1Name = first?.team1Name;
  const t1Players = first?.team1Players;

  const t2Code = first?.team2Code;
  const t2Name = first?.team2Name;
  const t2Players = first?.team2Players;

  const score1 = getTeamScore(t1Code, t1Name, t1Players);
  const score2 = getTeamScore(t2Code, t2Name, t2Players);

  const maxScore = Math.max(score1, score2);
  const totalScore = score1 + score2;
  const mapCount = maps.length;
  const latestTime = Math.max(...maps.map(m => new Date(m.time).getTime()));

  return maxScore * 100000000 + totalScore * 10000 + mapCount * 100 + (latestTime / 100000000000);
}

function groupMatchups(scrims: Scrim[]) {
  const matchups: Record<string, Scrim[]> = {};
  for (const s of scrims) {
    const key = [s.team1Code ?? "?", s.team2Code ?? "?"].sort().join("_");
    if (!matchups[key]) matchups[key] = [];
    matchups[key].push(s);
  }
  return matchups;
}

export default function ScrimsPage() {
  const { toast } = useToast();
  const [regionFilter, setRegionFilter] = useState<RegionKey>("EMEA");
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState("ALL");
  const [selectedMode, setSelectedMode] = useState("ALL");
  const [scrims, setScrims] = useState<Scrim[]>([]);
  const [metaTeams, setMetaTeams] = useState<{ code: string; name: string | null }[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [logos, setLogos] = useState<TeamLogos>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const today = new Date();
  const displayDate = new Date(today);
  displayDate.setDate(displayDate.getDate() - dateOffset);
  const dateStr = formatDate(displayDate);
  const isToday = dateOffset === 0;
  const isYesterday = dateOffset === 1;
  const dateLabel = isToday
    ? "Today"
    : isYesterday
    ? "Yesterday"
    : displayDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  useEffect(() => {
    fetch("/api/pro-teams/leaderboard")
      .then(r => r.json())
      .then((data: { code: string; logo?: string }[]) => {
        const map: TeamLogos = {};
        if (Array.isArray(data)) data.forEach(t => { if (t.code && t.logo) map[t.code] = t.logo; });
        setLogos(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/scrims/meta?region=${regionFilter}&date=${dateStr}`)
      .then(r => r.json())
      .then(d => {
        if (d.teams) setMetaTeams(d.teams);
        if (d.regionCounts) setRegionCounts(d.regionCounts);
      })
      .catch(() => {});
  }, [regionFilter, dateStr]);

  useEffect(() => { loadScrims(); }, [dateStr, selectedTeam, selectedMode, regionFilter]);

  async function loadScrims() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", date: dateStr, region: regionFilter });
      if (selectedTeam !== "ALL") params.set("team", selectedTeam);
      if (selectedMode !== "ALL") params.set("mode", selectedMode);
      const r = await fetch(`/api/scrims?${params}`);
      const data = await r.json();
      setScrims(Array.isArray(data) ? data : []);
    } catch { setScrims([]); }
    finally { setLoading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await fetch("/api/scrims/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      }).then(r => r.json());
      toast({ title: "Sync complete", description: `${r.inserted ?? 0} new scrims added`, className: "bg-green-500/10 border-green-500/30 font-mono" });
      loadScrims();
    } catch {
      toast({ title: "Sync failed", variant: "destructive", className: "font-mono" });
    } finally { setSyncing(false); }
  }

  const filtered = scrims.filter((s) => {
    if (selectedTeam !== "ALL" && s.team1Code !== selectedTeam && s.team2Code !== selectedTeam) return false;
    if (selectedMode !== "ALL" && s.mode !== selectedMode) return false;
    return true;
  });

  const matchupGroups = groupMatchups(filtered);
  const totalMaps = filtered.length;
  const totalMatchups = Object.keys(matchupGroups).length;

  const REGION_TABS: RegionKey[] = ["EMEA", "NA", "SA", "EA"];

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <main className="flex-1 max-w-[1400px] mx-auto px-4 md:px-6 py-8 w-full">

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Swords className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
                SCRIMS TRACKER
                <Badge className={`text-xs font-mono uppercase px-2.5 py-0.5 border ${REGION_TAB_META[regionFilter].badgeBg}`}>
                  {REGION_TAB_META[regionFilter].icon} {REGION_TAB_META[regionFilter].label}
                </Badge>
              </h1>
              <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest mt-0.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> Live Practice & Competitive Log
              </p>
            </div>
          </div>
          <Button
            variant="outline" size="sm" onClick={handleSync} disabled={syncing}
            className="font-mono text-[10px] font-bold uppercase tracking-widest border-orange-600/30 text-orange-400 bg-orange-950/20 hover:bg-orange-950/40 h-9 px-4 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Data"}
          </Button>
        </div>

        {/* Region Filter Selector Header */}
        <div className="flex flex-wrap items-center gap-2 bg-card/20 border border-border/40 rounded-xl p-2 mb-6">
          {REGION_TABS.map((rk) => {
            const meta = REGION_TAB_META[rk];
            const isActive = regionFilter === rk;
            const count = regionCounts[rk] ?? 0;
            return (
              <button
                key={rk}
                onClick={() => { setRegionFilter(rk); setSelectedTeam("ALL"); }}
                className={`flex-1 min-w-[100px] py-2.5 px-3 text-[11px] font-mono font-bold rounded-lg transition-all uppercase tracking-widest border ${
                  isActive
                    ? meta.badgeBg
                    : "bg-card/40 text-muted-foreground border-border/30 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <span className="mr-1.5">{meta.icon}</span>
                {meta.label}
                {count > 0 && <span className="ml-1.5 opacity-50 font-normal">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Notice for Other Regions */}
        {regionFilter !== "EMEA" && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-amber-200/90 leading-relaxed">
              <span className="font-bold text-amber-300">Other Regions Active ({regionFilter}):</span> Scrims from {REGION_TAB_META[regionFilter].label} are displayed for reference. Global Brawler Stats, Meta Ratings, and Core Analytics are strictly calculated from <strong className="text-white">EMEA Scrims</strong> and Matchmaking tournament data.
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-card/20 border border-border/40 rounded-2xl p-3 mb-6 shadow-sm">
          {/* Date navigator */}
          <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-border/30 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/5"
              onClick={() => setDateOffset(d => d + 1)} disabled={dateOffset >= 30}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 min-w-[120px] justify-center">
              <Calendar className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">{dateLabel}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/5"
              onClick={() => setDateOffset(d => Math.max(0, d - 1))} disabled={dateOffset === 0}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-8 bg-border/40 hidden md:block" />

          <div className="flex items-center gap-3 flex-1 md:flex-none">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full sm:w-[220px] h-9 font-mono text-xs font-bold uppercase tracking-widest border-border/40 bg-black/40 rounded-xl">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs max-h-60">
                <SelectItem value="ALL">All Teams ({REGION_TAB_META[regionFilter].label})</SelectItem>
                {metaTeams.map((t) => (
                  <SelectItem key={t.code} value={t.code}>{t.name ?? t.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 font-mono text-xs font-bold uppercase tracking-widest border-border/40 bg-black/40 rounded-xl">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                <SelectItem value="ALL">All Modes</SelectItem>
                {Object.entries(MODE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{MODE_ICONS[k]} {v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest md:ml-auto">
            {loading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  {totalMatchups} matchups
                </span>
                <span className="text-border/60">·</span>
                <span>{totalMaps} maps</span>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-card/20 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : totalMatchups === 0 ? (
          <div className="text-center py-32 border border-dashed border-border/40 rounded-2xl bg-card/10">
            <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground text-sm font-mono font-bold uppercase tracking-widest">No scrims found for {REGION_TAB_META[regionFilter].label}.</p>
            <p className="text-muted-foreground/50 text-[10px] font-mono mt-2 uppercase tracking-widest">Click Sync Data to update, or try another region / date</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {Object.entries(matchupGroups)
              .sort((a, b) => getMatchupScore(b[1]) - getMatchupScore(a[1]))
              .map(([key, maps]) => {
                const first = maps[0];
                return (
                  <MatchupRow
                    key={key}
                    t1Code={first.team1Code ?? null}
                    t1Name={first.team1Name ?? null}
                    t2Code={first.team2Code ?? null}
                    t2Name={first.team2Name ?? null}
                    maps={maps}
                    logos={logos}
                  />
                );
              })}
          </motion.div>
        )}
      </main>
    </div>
  );
}

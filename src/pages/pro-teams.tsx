import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Shield, Activity, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ProTeam = {
  rank: number;
  name: string;
  points: number;
  region: "EMEA" | "NA" | "EA" | "SA";
  roster: string[];
  winRate: number | null;
  wins: number;
  losses: number;
  qualifiedEvents: string[];
  logo: string;
  isTryout: boolean;
  code: string;
};

const RANK_COLORS: Record<number, { text: string; bg: string; border: string; glow: string }> = {
  1: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", glow: "shadow-[0_0_30px_rgba(234,179,8,0.2)]" },
  2: { text: "text-gray-300",   bg: "bg-gray-400/10",   border: "border-gray-400/30",   glow: "shadow-[0_0_20px_rgba(156,163,175,0.15)]" },
  3: { text: "text-amber-600",  bg: "bg-amber-600/10",  border: "border-amber-600/30",  glow: "shadow-[0_0_20px_rgba(217,119,6,0.15)]" },
};

const REGION_META = {
  EMEA: { dot: "bg-blue-500", flag: "🇪🇺", label: "EMEA", badge: "bg-blue-500/15 border-blue-500/40 text-blue-400" },
  NA:   { dot: "bg-red-500",  flag: "🇺🇸", label: "NA",   badge: "bg-red-500/15 border-red-500/40 text-red-400" },
  EA:   { dot: "bg-rose-500", flag: "🌏", label: "EA",   badge: "bg-rose-500/15 border-rose-500/40 text-rose-400" },
  SA:   { dot: "bg-green-500",flag: "🌎", label: "SA",   badge: "bg-green-500/15 border-green-500/40 text-green-400" },
};

function wrColor(wr: number | null) {
  if (wr == null) return "text-white/30";
  return wr >= 60 ? "text-emerald-400" : wr >= 50 ? "text-yellow-400" : "text-red-400";
}

function wrBgColor(wr: number) {
  return wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : "#ef4444";
}

const TeamCard: React.FC<{ team: ProTeam }> = ({ team }) => {
  const rankStyle = RANK_COLORS[team.rank];
  const reg = REGION_META[team.region];
  const wr = team.winRate;
  const total = team.wins + team.losses;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="cursor-default"
    >
      <div className={`group relative bg-card/25 border border-border/40 hover:border-border/70 hover:bg-card/40 transition-all duration-300 overflow-hidden rounded-2xl shadow-sm hover:shadow-lg ${rankStyle?.glow ?? ""}`}>
        {/* Region accent stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${reg.dot} opacity-70 group-hover:opacity-100 transition-opacity rounded-l-2xl`} />

        <div className="flex flex-col lg:flex-row">
          {/* Rank + logo block */}
          <div className={`flex flex-row lg:flex-col items-center gap-4 lg:gap-3 p-4 lg:p-0 lg:w-32 lg:border-r border-border/30 lg:justify-center ${rankStyle ? `${rankStyle.bg} ${rankStyle.border}` : ""}`}>
            <div className={`text-4xl lg:text-5xl font-black font-mono leading-none ${rankStyle?.text ?? "text-white/30"}`}>
              #{team.rank}
            </div>
            {team.logo ? (
              <img src={team.logo} alt={team.name}
                className="w-12 h-12 lg:w-16 lg:h-16 object-contain drop-shadow-xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white/20" />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 p-5 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                  {team.name}
                  {team.isTryout && (
                    <Badge className="text-[8px] px-1.5 py-0 bg-white/5 border-white/15 text-white/40 font-mono uppercase">Tryout</Badge>
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {team.code && (
                    <span className="text-xs font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 text-foreground/70">{team.code}</span>
                  )}
                  <span className="text-primary font-black text-sm font-mono">{team.points} PTS</span>
                </div>
              </div>
              <Badge className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest border ${reg.badge} flex items-center gap-1.5`}>
                <span>{reg.flag}</span> {reg.label}
              </Badge>
            </div>

            <div className="flex flex-col lg:flex-row gap-5">
              {/* Roster */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Roster
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {team.roster.length > 0 ? team.roster.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/8 text-[11px] font-mono font-bold text-white/80">
                      <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                      {p.replace(/^[A-Z]+\|/i, "")}
                    </div>
                  )) : (
                    <span className="text-muted-foreground/30 text-xs font-mono italic">Roster pending…</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="shrink-0 w-full lg:w-48 space-y-3">
                <div className="bg-black/30 border border-white/5 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Win Rate</span>
                    <span className={`text-2xl font-black font-mono ${wrColor(wr)}`}>
                      {wr != null ? `${wr.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  {wr != null && (
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mt-1">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${wr}%`, backgroundColor: wrBgColor(wr) }} />
                    </div>
                  )}
                  <div className="flex justify-between mt-2 text-[10px] font-mono">
                    <span className="text-emerald-400">{team.wins}W</span>
                    <span className="text-muted-foreground/40">{total}G</span>
                    <span className="text-red-400">{team.losses}L</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Qualified events */}
            {team.qualifiedEvents.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/20 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Qualified:</span>
                {team.qualifiedEvents.map((ev) => (
                  <Badge key={ev} className="text-[9px] px-2 py-0.5 bg-yellow-500/10 border-yellow-500/30 text-yellow-400 font-mono font-bold gap-1">
                    <Trophy className="w-2.5 h-2.5" /> {ev}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type RegionFilter = "EMEA" | "NA" | "EA" | "SA";

export default function ProTeamsPage() {
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("EMEA");

  const { data: teams, isLoading, error } = useQuery<ProTeam[]>({
    queryKey: ["/api/pro-teams/leaderboard"],
    queryFn: () => fetch(`/api/pro-teams/leaderboard?_t=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 2,
  });

  const byRegion = (r: string) => (teams ?? []).filter((t) => t.region === r);
  const filtered = byRegion(regionFilter);

  const FILTERS: { key: RegionFilter; label: string; icon: string }[] = [
    { key: "EMEA", label: "EMEA", icon: "🇪🇺" },
    { key: "NA",   label: "NA",   icon: "🇺🇸" },
    { key: "SA",   label: "SA",   icon: "🌎" },
    { key: "EA",   label: "EA",   icon: "🌏" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">PRO TEAMS</h1>
              <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest mt-0.5 flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" /> BSC 2026 Standings
              </p>
            </div>
          </div>
        </div>

        {/* Region filter */}
        <div className="flex flex-wrap items-center gap-2 bg-card/20 border border-border/40 rounded-xl p-2 mb-6">
          {FILTERS.map(({ key, label, icon }) => {
            const count = byRegion(key).length;
            const isActive = regionFilter === key;
            return (
              <button key={key} onClick={() => setRegionFilter(key)}
                className={`flex-1 min-w-[72px] py-2.5 px-3 text-[11px] font-mono font-bold rounded-lg transition-all uppercase tracking-widest border ${
                  isActive
                    ? key === "EMEA" ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                      : key === "NA" ? "bg-red-600/20 text-red-400 border-red-500/40"
                      : key === "SA" ? "bg-green-600/20 text-green-400 border-green-500/40"
                      : "bg-rose-600/20 text-rose-400 border-rose-500/40"
                    : "bg-card/40 text-muted-foreground border-border/30 hover:bg-white/5 hover:text-foreground"
                }`}>
                <span className="mr-1">{icon}</span>
                {label}
                {count > 0 && <span className="ml-1 opacity-40 font-normal">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-card/20 border border-border/30 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 border border-dashed border-red-500/30 rounded-2xl bg-red-500/5">
            <Shield className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
            <p className="text-red-400 font-bold font-mono">Failed to load leaderboard.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded-2xl">
            <p className="text-muted-foreground font-mono text-sm">No teams found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((team) => (
              <TeamCard key={`${team.region}-${team.rank}-${team.name}`} team={team} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

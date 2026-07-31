import React, { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, RefreshCw, Trophy, Activity, AlertCircle, Search, X, Filter, ChevronDown, ChevronUp, Map as MapIcon, ExternalLink } from "lucide-react";
import {
  useGetTournament,
  useListTournamentMatches,
  useRefreshTournament,
  getGetTournamentQueryKey,
  getListTournamentMatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getBrawlerImg } from "@/lib/brawl-utils";
import { AnimatePresence, motion } from "framer-motion";

type DraftEntry = { team: string; value: string; imageUrl: string | null; type: string; playerName?: string | null };
type MapDraft = {
  mapName: string; gameMode: string | null; winner: string | null;
  team1Score: number | null; team2Score: number | null;
  picks: DraftEntry[]; bans: DraftEntry[];
};

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

function splitSet(set: MapDraft, team1: string, team2: string) {
  const t1Bans = set.bans.filter((b) => b.team === team1);
  const t2Bans = set.bans.filter((b) => b.team === team2);
  const allBans = set.bans;
  const t1BansFinal = t1Bans.length > 0 ? t1Bans : allBans.slice(0, Math.ceil(allBans.length / 2));
  const t2BansFinal = t2Bans.length > 0 ? t2Bans : allBans.slice(Math.ceil(allBans.length / 2));
  return {
    t1Bans: t1BansFinal,
    t2Bans: t2BansFinal,
    t1Picks: set.picks.filter((p) => p.team === team1),
    t2Picks: set.picks.filter((p) => p.team === team2),
  };
}

function roundPriority(roundName: string | null | undefined): number {
  if (!roundName) return -1;
  if (roundName === "Final") return 1000;
  if (roundName === "Grand Final") return 1100;
  if (roundName === "Semi") return 900;
  if (roundName === "Quarter") return 800;
  const rMatch = roundName.match(/^R(\d+)$/);
  if (rMatch) return parseInt(rMatch[1], 10);
  return 0;
}

function ChipList({ entries, type, team, highlight, highlightBrawlers }: { entries: DraftEntry[], type: "pick" | "ban", team: "t1" | "t2", highlight: string, highlightBrawlers: Set<string> }) {
  if (entries.length === 0) return <span className="text-white/10 font-mono text-[9px]">—</span>;
  return (
    <div className={`flex flex-col gap-1.5 ${team === "t1" ? "items-start" : "items-end"}`}>
      {entries.map((e, i) => {
        const hPlayer = highlight && e.playerName?.toLowerCase().includes(highlight.toLowerCase());
        const hBrawlerName = highlight && e.value.toLowerCase().includes(highlight.toLowerCase());
        const hBrawler = highlightBrawlers.has(e.value);
        const isHighlighted = hPlayer || hBrawlerName || hBrawler;
        
        return (
          <div key={i} className={`flex items-center gap-2 p-1 rounded-md transition-colors ${isHighlighted ? "bg-primary/20 ring-1 ring-primary/50" : ""} ${team === "t2" ? "flex-row-reverse text-right" : ""}`}>
            <div className="relative">
              <img src={e.imageUrl ?? getBrawlerImg(e.value)} alt={e.value} className={`w-7 h-7 rounded-full bg-black/40 object-cover border border-white/10 ${type === "ban" ? "grayscale opacity-50" : ""}`} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {type === "ban" && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full flex items-center justify-center shadow"><X className="w-2.5 h-2.5 text-white" /></div>}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <span className={`text-[10px] font-bold font-mono capitalize leading-tight ${type === "ban" ? "text-red-400/80" : "text-foreground"}`}>{e.value.toLowerCase()}</span>
              {e.playerName && type === "pick" && <span className={`text-[9px] font-mono leading-tight truncate max-w-[80px] ${hPlayer ? "text-primary font-bold" : "text-muted-foreground/60"}`}>{e.playerName}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoundBadge({ label }: { label: string }) {
  if (label === "Final" || label === "Grand Final") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[9px] font-mono font-bold px-1.5 py-0 uppercase shadow-[0_0_10px_rgba(234,179,8,0.2)]">{label}</Badge>;
  if (label === "Semi") return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 text-[9px] font-mono font-bold px-1.5 py-0 uppercase">{label}</Badge>;
  if (label === "Quarter") return <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/40 text-[9px] font-mono font-bold px-1.5 py-0 uppercase">{label}</Badge>;
  return <Badge variant="outline" className="bg-card/40 text-muted-foreground border-border/50 text-[9px] font-mono font-bold px-1.5 py-0 uppercase">{label}</Badge>;
}

export default function TournamentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRounds, setSelectedRounds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModes, setSelectedModes] = useState<Set<string>>(new Set());
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [selectedBrawlers, setSelectedBrawlers] = useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(id, {
    query: {
      enabled: !!id,
      queryKey: getGetTournamentQueryKey(id),
      refetchInterval: (query) => {
        const data = query.state.data as any;
        return data?.status === "fetching" ? 3000 : false;
      },
    },
  });
  
  const { data: matches, isLoading: loadingMatches } = useListTournamentMatches(id, {
    query: {
      enabled: !!id,
      queryKey: getListTournamentMatchesQueryKey(id),
      refetchInterval: () => {
        return tournament?.status === "fetching" ? 3000 : false;
      },
    },
  });
  
  const refreshMutation = useRefreshTournament();

  const allRounds = useMemo(() => {
    const rounds = new Set<string>();
    (matches ?? []).forEach((m) => { if (m.roundName) rounds.add(m.roundName); });
    return Array.from(rounds).sort((a, b) => roundPriority(b) - roundPriority(a));
  }, [matches]);

  const allModes = useMemo(() => {
    const modes = new Set<string>();
    (matches ?? []).forEach((m) => {
      ((m.maps ?? []) as MapDraft[]).forEach((s) => { if (s.gameMode) modes.add(s.gameMode); });
    });
    return Array.from(modes).sort();
  }, [matches]);

  const allMaps = useMemo(() => {
    const maps = new Set<string>();
    (matches ?? []).forEach((m) => {
      ((m.maps ?? []) as MapDraft[]).forEach((s) => { if (s.mapName) maps.add(s.mapName); });
    });
    return Array.from(maps).sort();
  }, [matches]);

  const allBrawlers = useMemo(() => {
    const brawlers = new Set<string>();
    (matches ?? []).forEach((m) => {
      ((m.maps ?? []) as MapDraft[]).forEach((s) => {
        [...s.picks, ...s.bans].forEach((e) => { if (e.value) brawlers.add(e.value); });
      });
    });
    return Array.from(brawlers).sort();
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches]
      .sort((a, b) => roundPriority(b.roundName) - roundPriority(a.roundName))
      .filter((match) => {
        if (selectedRounds.size > 0 && !selectedRounds.has(match.roundName ?? "")) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const sets = (match.maps ?? []) as MapDraft[];
          const teamMatch = match.team1Name.toLowerCase().includes(q) || match.team2Name.toLowerCase().includes(q);
          const playerMatch = sets.some((s) =>
            [...s.picks].some((p) => p.playerName?.toLowerCase().includes(q) || p.value.toLowerCase().includes(q))
          );
          if (!teamMatch && !playerMatch) return false;
        }

        if (selectedBrawlers.size > 0) {
          const sets = (match.maps ?? []) as MapDraft[];
          const hasBrawler = sets.some((s) =>
            [...s.picks, ...s.bans].some((e) =>
              selectedBrawlers.has(e.value)
            )
          );
          if (!hasBrawler) return false;
        }

        return true;
      })
      .map((match) => {
        if (selectedModes.size === 0 && selectedMaps.size === 0) return match;
        const filteredSets = ((match.maps ?? []) as MapDraft[]).filter((s) => {
          if (selectedModes.size > 0 && s.gameMode && !selectedModes.has(s.gameMode)) return false;
          if (selectedMaps.size > 0 && !selectedMaps.has(s.mapName)) return false;
          return true;
        });
        return { ...match, maps: filteredSets };
      })
      .filter((match) => {
        if (selectedModes.size > 0 || selectedMaps.size > 0) {
          return (match.maps as MapDraft[]).length > 0;
        }
        return true;
      });
  }, [matches, selectedRounds, searchQuery, selectedModes, selectedMaps, selectedBrawlers]);

  const handleRefresh = () => {
    refreshMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Refreshing", description: "Fetching latest data…" });
        queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTournamentMatchesQueryKey(id) });
      },
    });
  };

  const toggleRound = (round: string) => {
    setSelectedRounds((prev) => { const n = new Set(prev); n.has(round) ? n.delete(round) : n.add(round); return n; });
  };
  const toggleMode = (mode: string) => {
    setSelectedModes((prev) => { const n = new Set(prev); n.has(mode) ? n.delete(mode) : n.add(mode); return n; });
  };
  const toggleMap = (map: string) => {
    setSelectedMaps((prev) => { const n = new Set(prev); n.has(map) ? n.delete(map) : n.add(map); return n; });
  };
  const toggleBrawler = (brawler: string) => {
    setSelectedBrawlers((prev) => { const n = new Set(prev); n.has(brawler) ? n.delete(brawler) : n.add(brawler); return n; });
  };

  const clearAllFilters = () => {
    setSelectedRounds(new Set());
    setSearchQuery("");
    setSelectedModes(new Set());
    setSelectedMaps(new Set());
    setSelectedBrawlers(new Set());
  };

  const hasActiveFilters = selectedRounds.size > 0 || searchQuery.trim() || selectedModes.size > 0 || selectedMaps.size > 0 || selectedBrawlers.size > 0;

  if (loadingTournament || loadingMatches) {
    return (
      <div className="min-h-screen w-full p-6 md:p-10 max-w-[1800px] mx-auto space-y-4 bg-background">
        <Skeleton className="h-8 w-36 bg-card/40" />
        <Skeleton className="h-24 w-full bg-card/40 rounded-2xl" />
        <Skeleton className="h-[500px] w-full bg-card/40 rounded-2xl" />
      </div>
    );
  }

  if (!tournament) return <div className="p-12 text-center text-muted-foreground font-mono uppercase tracking-widest">Tournament not found</div>;

  const maxSets = Math.max(1, ...filteredMatches.map((m) => (m.maps as MapDraft[])?.length ?? 0));
  
  // Get tournament background image
  const mapImages = Object.values(MAP_IMAGES);
  const bgImage = tournament.imageUrl || mapImages[tournament.id % mapImages.length];

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      
      {/* Top Header */}
      <header className="w-full border-b border-border/40 bg-card/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/5 -ml-3">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline-block font-mono font-bold uppercase tracking-widest text-[10px]">Back to Hub</span>
            </Button>
          </Link>
          <div className="flex gap-2.5">
            {tournament.url && (
              <a
                href={tournament.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-foreground transition-colors text-[10px] font-mono font-bold uppercase tracking-widest"
              >
                <img
                  src="https://matcherino.com/favicon.ico"
                  alt="Matcherino"
                  className="w-3.5 h-3.5 rounded-sm object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                Matcherino
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
            <Button onClick={handleRefresh} disabled={refreshMutation.isPending || tournament.status === "fetching"} variant="outline" size="sm" className="font-mono text-[10px] font-bold uppercase tracking-widest border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary-foreground transition-colors h-9 px-4">
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshMutation.isPending || tournament.status === "fetching" ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-[1800px] mx-auto w-full">
        {/* Tournament Hero */}
        <div className="mb-6 relative bg-card/20 border border-border/40 rounded-2xl overflow-hidden shadow-sm">
          {/* Background Blur */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center opacity-10 blur-[4px] mix-blend-screen"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-background via-background/90 to-background/50 pointer-events-none" />
          
          <div className="relative z-10 p-5 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {tournament.imageUrl ? (
                <img src={tournament.imageUrl} alt={tournament.name} className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border-2 border-white/10 shadow-lg" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <Trophy className="w-8 h-8 md:w-10 md:h-10 text-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
                </div>
              )}
              
              <div>
                <h1 className="text-3xl md:text-4xl font-black font-mono tracking-tight text-foreground line-clamp-1 mb-2">{tournament.name}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-foreground/80 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1">
                    {tournament.gameName || "Brawl Stars"}
                  </Badge>
                  {tournament.eventDate && (
                    <Badge variant="outline" className="bg-white/5 border-white/10 text-foreground/80 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1">
                      {new Date(tournament.eventDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </Badge>
                  )}
                  {tournament.status === "fetching" && (
                    <Badge variant="outline" className="bg-primary/10 border-primary/40 text-primary font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                      <Activity className="w-3 h-3 mr-1.5 animate-pulse" /> Updating
                    </Badge>
                  )}
                  {tournament.status === "error" && (
                    <Badge variant="destructive" className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                      <AlertCircle className="w-3 h-3 mr-1.5" /> Error
                    </Badge>
                  )}
                </div>
                {tournament.status === "error" && (tournament as any).errorMessage && (
                  <div className="mt-2 text-[10px] text-destructive/80 font-mono bg-destructive/10 border border-destructive/20 rounded-md px-3 py-1.5 max-w-xl truncate" title={(tournament as any).errorMessage}>
                    {(tournament as any).errorMessage}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
              <div className="flex flex-col text-center px-4">
                <span className="text-3xl font-black font-mono text-primary">{tournament.matchCount}</span>
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mt-1">Total Matches</span>
              </div>
              
              <div className="w-px h-10 bg-border/50" />
              
              <div className="flex flex-col text-center px-4">
                <span className="text-3xl font-black font-mono text-foreground/90">{filteredMatches.length}</span>
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mt-1">Filtered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-card/20 border border-border/40 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2.5 pl-2 pr-4 border-r border-border/40 shrink-0">
              <Filter className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono font-bold text-foreground uppercase tracking-widest hidden sm:inline-block">Filters</span>
            </div>
            
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                placeholder="Search team or player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 text-sm pl-10 font-mono bg-black/40 border-border/50 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/50 shadow-inner"
              />
              {searchQuery && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery("")}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            <button
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className={`inline-flex items-center gap-2 h-10 px-4 text-xs font-mono font-bold uppercase tracking-widest rounded-lg transition-colors ml-auto sm:ml-0 border ${
                filtersExpanded 
                  ? "bg-primary/10 border-primary/30 text-primary" 
                  : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
            >
              {filtersExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Hide Advanced
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Advanced Filters
                </>
              )}
            </button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-10 px-4 text-xs font-mono font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 uppercase tracking-widest border border-red-500/20" onClick={clearAllFilters}>
                <X className="w-4 h-4 mr-2" /> Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters Drawer */}
          <AnimatePresence>
            {filtersExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-4 bg-card/30 border border-border/40 rounded-xl p-5 shadow-inner">
                  {allRounds.length > 0 && (
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 w-20 pt-1.5 shrink-0">
                        <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Round</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allRounds.map((r) => (
                          <button
                            key={r}
                            onClick={() => toggleRound(r)}
                            className={`text-xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border ${
                              selectedRounds.has(r)
                                ? r === "Final" || r === "Grand Final"
                                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                                  : r === "Semi"
                                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                                  : r === "Quarter"
                                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                                  : "bg-primary/20 border-primary/50 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                : "bg-black/40 border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-black/60"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {allModes.length > 0 && (
                    <div className="flex items-start gap-4 pt-4 border-t border-border/30">
                      <div className="flex items-center gap-2 w-20 pt-1.5 shrink-0">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Mode</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allModes.map((m) => {
                          const modeKey = m.replace(/\s/g, "").replace(/^./, c => c.toLowerCase());
                          return (
                            <button
                              key={m}
                              onClick={() => toggleMode(m)}
                              className={`flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border ${
                                selectedModes.has(m)
                                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                  : "bg-black/40 border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-black/60"
                              }`}
                            >
                              <span>{MODE_ICONS[modeKey] || ""}</span> {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allMaps.length > 0 && (
                    <div className="flex items-start gap-4 pt-4 border-t border-border/30">
                      <div className="flex items-center gap-2 w-20 pt-1.5 shrink-0">
                        <MapIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Map</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allMaps.map((m) => {
                          // Find map image if we have it
                          const mapThumb = MAP_IMAGES[m];
                          return (
                            <button
                              key={m}
                              onClick={() => toggleMap(m)}
                              className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border ${
                                selectedMaps.has(m)
                                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                  : "bg-black/40 border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-black/60"
                              }`}
                            >
                              {mapThumb && (
                                <img src={mapThumb} alt="" className="w-5 h-4 object-cover rounded border border-white/10" />
                              )}
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allBrawlers.length > 0 && (
                    <div className="flex items-start gap-4 pt-4 border-t border-border/30">
                      <div className="flex items-center gap-2 w-20 pt-1.5 shrink-0">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Brawler</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar p-1">
                        {allBrawlers.map((b) => (
                          <button
                            key={b}
                            onClick={() => toggleBrawler(b)}
                            className={`flex items-center gap-2 text-xs font-mono font-bold capitalize px-3 py-1.5 rounded-md transition-colors border ${
                              selectedBrawlers.has(b)
                                ? "bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                                : "bg-black/40 border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-black/60"
                            }`}
                          >
                            <img src={getBrawlerImg(b)} alt="" className="w-5 h-5 rounded-full bg-black/40 object-cover border border-white/10" />
                            {b.toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table Area */}
        {!filteredMatches || filteredMatches.length === 0 ? (
          <div className="text-center py-32 border border-dashed border-border/40 rounded-2xl bg-card/10">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest font-bold">
              {hasActiveFilters ? "No matches match the current filters." : "No matches found yet."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-6 font-mono text-xs font-bold uppercase tracking-widest border-border/50 hover:bg-white/10 px-6 h-10" onClick={clearAllFilters}>Clear All Filters</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50 shadow-2xl bg-[#0a0a10] custom-scrollbar">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] font-mono font-bold uppercase tracking-widest">
                  <th colSpan={4} className="px-4 py-2 bg-card/80 border-b border-r border-border/50 text-muted-foreground/50 sticky left-0 z-20 backdrop-blur-md" />
                  {Array.from({ length: maxSets }, (_, i) => (
                    <th key={i} colSpan={5} className={`px-4 py-2 text-center border-b border-border/50 bg-card/30 ${i < maxSets - 1 ? "border-r" : ""}`}>
                      <span className="text-foreground/80 tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/10">Set {i + 1}</span>
                    </th>
                  ))}
                </tr>
                <tr className="bg-card/80 text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-4 text-left border-b border-r border-border/50 whitespace-nowrap sticky left-0 z-20 bg-card/90 backdrop-blur-xl">Round</th>
                  <th className="px-5 py-4 text-left border-b border-r border-border/50 whitespace-nowrap sticky left-20 z-20 bg-card/90 backdrop-blur-xl shadow-[4px_0_10px_rgba(0,0,0,0.2)]">Match</th>
                  <th className="px-5 py-4 text-center border-b border-r border-border/50 whitespace-nowrap">Score</th>
                  <th className="px-5 py-4 text-left border-b border-r border-border/50 whitespace-nowrap">Winner</th>
                  {Array.from({ length: maxSets }, (_, i) => (
                    <React.Fragment key={i}>
                      <th className="px-4 py-4 text-left border-b border-border/50 bg-black/40 whitespace-nowrap">Map</th>
                      <th className="px-4 py-4 text-left border-b border-border/50 bg-blue-950/20 whitespace-nowrap text-blue-400">T1 Bans</th>
                      <th className="px-4 py-4 text-left border-b border-border/50 bg-blue-950/20 whitespace-nowrap text-blue-400">T1 Picks</th>
                      <th className="px-4 py-4 text-left border-b border-border/50 bg-orange-950/20 whitespace-nowrap text-orange-400">T2 Bans</th>
                      <th className={`px-4 py-4 text-left border-b whitespace-nowrap bg-orange-950/20 text-orange-400 ${i < maxSets - 1 ? "border-r border-border/50" : "border-border/50"}`}>T2 Picks</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredMatches.map((match, mi) => {
                  const sets = (match.maps ?? []) as MapDraft[];
                  const isT1Winner = match.winnerName === match.team1Name;
                  const isT2Winner = match.winnerName === match.team2Name;

                  return (
                    <tr key={match.id} className={`hover:bg-white/[0.03] transition-colors ${mi % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"}`}>
                      <td className="px-5 py-4 border-r border-border/40 whitespace-nowrap align-top sticky left-0 bg-background/95 backdrop-blur z-10 w-20">
                        <RoundBadge label={match.roundName ?? "—"} />
                      </td>
                      <td className="px-5 py-4 border-r border-border/40 whitespace-nowrap align-top sticky left-20 bg-background/95 backdrop-blur z-10 min-w-[160px] shadow-[4px_0_10px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col gap-2">
                          <span className={`font-black text-sm md:text-base tracking-tight ${isT1Winner ? "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" : "text-foreground"}`}>{match.team1Name}</span>
                          <span className="text-muted-foreground/30 text-[9px] font-mono font-bold bg-white/5 w-fit px-1.5 py-0.5 rounded">VS</span>
                          <span className={`font-black text-sm md:text-base tracking-tight ${isT2Winner ? "text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]" : "text-foreground"}`}>{match.team2Name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 border-r border-border/40 text-center whitespace-nowrap align-middle">
                        {match.score ? (
                          <span className="font-mono text-base md:text-lg font-black bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 tracking-widest shadow-inner">{match.score}</span>
                        ) : <span className="text-muted-foreground/20 text-lg">—</span>}
                      </td>
                      <td className="px-5 py-4 border-r border-border/40 whitespace-nowrap align-middle">
                        {match.winnerName ? (
                          <span className={`text-[11px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 ${isT1Winner ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-orange-400 bg-orange-500/10 border-orange-500/20"} px-3 py-1.5 rounded-md border shadow-sm`}>
                            <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">{match.winnerName}</span>
                          </span>
                        ) : <span className="text-muted-foreground/20">—</span>}
                      </td>

                      {Array.from({ length: maxSets }, (_, si) => {
                        const set = sets[si] as MapDraft | undefined;
                        if (!set) {
                          return (
                            <React.Fragment key={si}>
                              {[0,1,2,3,4].map((ci) => (
                                <td key={ci} className={`px-4 py-4 align-middle bg-black/20 ${ci === 4 && si < maxSets - 1 ? "border-r border-border/40" : ""}`}>
                                  <span className="text-white/5 text-sm block text-center">—</span>
                                </td>
                              ))}
                            </React.Fragment>
                          );
                        }
                        const { t1Bans, t2Bans, t1Picks, t2Picks } = splitSet(set, match.team1Name, match.team2Name);
                        const setWinnerIsT1 = set.winner === match.team1Name;
                        const setWinnerIsT2 = set.winner === match.team2Name;
                        
                        // Find map thumbnail
                        const mapThumb = MAP_IMAGES[set.mapName];
                        const modeKey = set.gameMode?.replace(/\s/g, "").replace(/^./, c => c.toLowerCase());

                        return (
                          <React.Fragment key={si}>
                            <td className={`px-4 py-4 align-top min-w-[140px] bg-black/20 ${set.winner ? (setWinnerIsT1 ? "border-l-2 border-l-blue-500/50" : "border-l-2 border-l-orange-500/50") : ""}`}>
                              <div className="flex flex-col gap-2">
                                {mapThumb && (
                                  <div className="relative w-full h-16 rounded-lg overflow-hidden border border-white/10 shadow-sm mb-1 group">
                                    <img src={mapThumb} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                    <div className="absolute bottom-1 left-1.5 right-1.5">
                                      <span className="text-[11px] font-black text-white truncate block drop-shadow-md">{set.mapName}</span>
                                    </div>
                                  </div>
                                )}
                                {!mapThumb && <span className="text-[11px] font-black text-foreground/90 whitespace-nowrap tracking-tight">{set.mapName}</span>}
                                
                                {set.gameMode && (
                                  <span className="text-[10px] text-muted-foreground/80 font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 bg-white/5 w-fit px-2 py-0.5 rounded">
                                    {modeKey && MODE_ICONS[modeKey] && <span>{MODE_ICONS[modeKey]}</span>}
                                    {set.gameMode}
                                  </span>
                                )}
                                
                                {set.winner && (
                                  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md border ${
                                    setWinnerIsT1 
                                      ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
                                      : "text-orange-400 bg-orange-500/10 border-orange-500/20"
                                  }`}>
                                    <Trophy className="w-3 h-3" />
                                    <span className="truncate max-w-[90px]">{set.winner}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top bg-blue-950/10 min-w-[130px]">
                              <ChipList entries={t1Bans} type="ban" team="t1" highlight={searchQuery} highlightBrawlers={selectedBrawlers} />
                            </td>
                            <td className="px-3 py-3 align-top bg-blue-950/10 min-w-[170px]">
                              <ChipList entries={t1Picks} type="pick" team="t1" highlight={searchQuery} highlightBrawlers={selectedBrawlers} />
                            </td>
                            <td className="px-3 py-3 align-top bg-orange-950/10 min-w-[130px]">
                              <ChipList entries={t2Bans} type="ban" team="t2" highlight={searchQuery} highlightBrawlers={selectedBrawlers} />
                            </td>
                            <td className={`px-3 py-3 align-top bg-orange-950/10 min-w-[170px] ${si < maxSets - 1 ? "border-r border-border/40" : ""}`}>
                              <ChipList entries={t2Picks} type="pick" team="t2" highlight={searchQuery} highlightBrawlers={selectedBrawlers} />
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
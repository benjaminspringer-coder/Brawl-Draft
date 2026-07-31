import { Loader2, ArrowLeft, Shield, X } from "lucide-react";
import { Link } from "wouter";
import { useGamePanel } from "@/context/GamePanelContext";
import { MatchDetailContent } from "@/components/MatchDetail";
import { findTeamLogo } from "@/lib/brawl-utils";
import { motion, AnimatePresence } from "framer-motion";
import type { GameRecord } from "@/lib/game-types";
import type { ProTeamMeta } from "@/lib/brawl-utils";

/** For known top-16 teams: return team name. For unknown teams: return first player's name. */
function resolveTitle(game: GameRecord, side: "t1" | "t2", proTeams: ProTeamMeta[]): string {
  const name = side === "t1" ? game.team1Name : game.team2Name;
  const code = side === "t1" ? game.team1Code : game.team2Code;
  const picks = side === "t1" ? game.team1Picks : game.team2Picks;

  // If we can find this team in proTeams (top 16), use the team name
  const logo = findTeamLogo(name, code, proTeams);
  if (logo) return name;

  // Unknown team: use the first player's name (strip team prefix like "HMB|PlayerName")
  const firstPlayer = picks?.[0]?.player?.replace(/^[A-Z0-9]+\|/i, "");
  return firstPlayer || name;
}

export default function MatchPanelPage() {
  const { panels, activePanel, setActivePanel, closePanel, proTeams } = useGamePanel();
  const activePanelData = panels.find((p) => p.key === activePanel) ?? panels[0] ?? null;

  if (panels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="text-5xl select-none">📋</div>
        <div className="font-mono font-bold text-foreground/60">No match open</div>
        <div className="text-xs font-mono text-muted-foreground/40">
          Go to Stats, select a Brawler, and click a Recorded Game.
        </div>
        <Link
          href="/maps"
          className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-primary hover:text-primary/70 transition-colors mt-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Stats
        </Link>
      </div>
    );
  }

  const t1 = activePanelData ? resolveTitle(activePanelData.baseGame, "t1", proTeams) : "";
  const t2 = activePanelData ? resolveTitle(activePanelData.baseGame, "t2", proTeams) : "";
  const t1Logo = activePanelData
    ? findTeamLogo(activePanelData.baseGame.team1Name, activePanelData.baseGame.team1Code, proTeams)
    : null;
  const t2Logo = activePanelData
    ? findTeamLogo(activePanelData.baseGame.team2Name, activePanelData.baseGame.team2Code, proTeams)
    : null;

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-border/30 bg-card/10 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/maps"
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Stats
            </Link>
          </div>

          {/* Match title */}
          {activePanelData && (
            <div className="flex items-center gap-3">
              {t1Logo ? (
                <img src={t1Logo} alt="" className="w-8 h-8 object-contain rounded-lg bg-black/20 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-muted-foreground/25" />
                </div>
              )}
              <span className="text-base font-black font-mono text-foreground truncate max-w-[160px]">{t1}</span>
              <span className="text-xs font-mono text-muted-foreground/30">vs</span>
              <span className="text-base font-black font-mono text-foreground truncate max-w-[160px]">{t2}</span>
              {t2Logo ? (
                <img src={t2Logo} alt="" className="w-8 h-8 object-contain rounded-lg bg-black/20 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-muted-foreground/25" />
                </div>
              )}
              {activePanelData.baseGame.roundName && (
                <span className="text-[9px] font-mono text-blue-400/70 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 shrink-0">
                  {activePanelData.baseGame.roundName}
                </span>
              )}
            </div>
          )}

          {/* Panel switcher tabs (if multiple panels open) */}
          {panels.length > 1 && (
            <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5">
              {panels.map((p) => {
                const isActive = p.key === (activePanelData?.key ?? "");
                const pt1 = resolveTitle(p.baseGame, "t1", proTeams);
                const pt2 = resolveTitle(p.baseGame, "t2", proTeams);
                return (
                  <button
                    key={p.key}
                    onClick={() => setActivePanel(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold shrink-0 transition-all border ${
                      isActive
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-white/5 border-border/20 text-muted-foreground/60 hover:text-foreground hover:border-border/40"
                    }`}
                  >
                    <span className="truncate max-w-[80px]">{pt1}</span>
                    <span className="opacity-40">vs</span>
                    <span className="truncate max-w-[80px]">{pt2}</span>
                    {p.loading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); closePanel(p.key); }}
                      className="opacity-30 hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Match content */}
      <div className="max-w-5xl mx-auto px-5 py-6">
        <AnimatePresence mode="wait">
          {activePanelData && (
            <motion.div
              key={activePanelData.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activePanelData.loading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
              ) : (
                <MatchDetailContent
                  baseGame={activePanelData.baseGame}
                  seriesGames={activePanelData.seriesGames ?? [activePanelData.baseGame]}
                  teams={proTeams}
                  selectedBrawler={activePanelData.selectedBrawler}
                  selectedMap={activePanelData.selectedMap}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

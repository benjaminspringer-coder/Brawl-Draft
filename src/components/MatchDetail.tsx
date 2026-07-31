import { Shield, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getBrawlerImg, displayName, MODE_EMOJI, MODE_COLOR, findTeamLogo } from "@/lib/brawl-utils";
import type { GameRecord, GamePick } from "@/lib/game-types";
import type { ProTeamMeta } from "@/lib/brawl-utils";

/* ── Ban brawler tile ─────────────────────────────────────────────── */
function BanTile({ brawler, imageUrl, size = "md" }: { key?: any; brawler: string; imageUrl: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-11 h-11" : "w-14 h-14";
  const nameLen = size === "sm" ? "max-w-[44px]" : "max-w-[56px]";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {/* Brawler photo background — always shows a coloured tile, image on top */}
        <div className={`${dim} rounded-xl bg-red-950/60 border border-red-900/40 overflow-hidden flex items-center justify-center`}>
          <img
            src={imageUrl ?? getBrawlerImg(brawler)}
            alt={brawler}
            className="w-full h-full object-cover grayscale opacity-50"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>
      <span className={`text-[9px] font-mono font-semibold text-red-400/70 ${nameLen} truncate text-center leading-tight`}>
        {displayName(brawler)}
      </span>
    </div>
  );
}

/* ── Single pick tile ────────────────────────────────────────────── */
function PickTile({
  pick,
  isWinner,
  reversed = false,
}: {
  key?: any;
  pick: GamePick;
  isWinner: boolean;
  reversed?: boolean;
}) {
  const cleanPlayer = pick.player?.replace(/^[A-Z0-9]{2,8}\|/i, "") ?? null;

  return (
    <div className={`flex items-center gap-2.5 ${reversed ? "flex-row-reverse" : ""}`}>
      <div className="relative shrink-0">
        {/* Brawler photo with fallback background */}
        <div className={`w-12 h-12 rounded-xl border-2 bg-white/5 overflow-hidden shadow-md transition-all ${
          isWinner
            ? "border-green-500/60 shadow-green-900/30"
            : "border-white/10"
        }`}>
          <img
            src={pick.imageUrl ?? getBrawlerImg(pick.brawler)}
            alt={pick.brawler}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        {isWinner && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border border-black flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12" fill="currentColor">
              <path d="M10 3L5 8.5L2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        )}
      </div>
      <div className={`min-w-0 ${reversed ? "text-right" : ""}`}>
        <div className="text-[12px] font-mono font-bold text-foreground/90 truncate leading-tight">
          {displayName(pick.brawler)}
        </div>
        {cleanPlayer && (
          <div className="text-[9px] font-mono text-muted-foreground/45 truncate mt-0.5">
            {cleanPlayer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Team header with logo ───────────────────────────────────────── */
function TeamHeader({
  name,
  logo,
  won,
  reversed = false,
}: {
  name: string;
  logo: string | null;
  won: boolean;
  reversed?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${reversed ? "flex-row-reverse" : ""} mb-3`}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="w-8 h-8 object-contain rounded-lg bg-black/20 shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-muted-foreground/25" />
        </div>
      )}
      <div className={`min-w-0 ${reversed ? "text-right" : ""}`}>
        <div className="text-[11px] font-mono font-bold text-foreground/85 truncate leading-tight">{name}</div>
        {won && (
          <div className="text-[9px] font-mono font-black text-green-400 tracking-widest uppercase">WIN</div>
        )}
      </div>
    </div>
  );
}

/* ── Bans row — full width, two columns ──────────────────────────── */
function BansRow({
  bansTeam1,
  bansTeam2,
  bansUnknown,
  team1Name,
  team2Name,
}: {
  bansTeam1: { brawler: string; imageUrl: string | null }[];
  bansTeam2: { brawler: string; imageUrl: string | null }[];
  bansUnknown: { brawler: string; imageUrl: string | null }[];
  team1Name: string;
  team2Name: string;
}) {
  const hasSides = bansTeam1.length > 0 || bansTeam2.length > 0;
  const hasUnknown = bansUnknown.length > 0;

  return (
    <div className="px-4 pt-3 pb-4 border-b border-red-950/40 bg-gradient-to-b from-red-950/12 to-red-950/5">
      {/* Ban label */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
        <span className="text-[9px] font-mono font-black text-red-400/80 uppercase tracking-[0.2em]">Bans</span>
      </div>

      {hasSides ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Team 1 bans */}
          <div>
            <div className="text-[7px] font-mono text-muted-foreground/35 uppercase tracking-widest mb-2 font-bold truncate">
              {team1Name}
            </div>
            <div className="flex flex-wrap gap-2">
              {bansTeam1.length === 0 ? (
                <span className="text-[9px] font-mono text-muted-foreground/20">—</span>
              ) : (
                bansTeam1.map((b, i) => <BanTile key={i} brawler={b.brawler} imageUrl={b.imageUrl} size="md" />)
              )}
            </div>
          </div>
          {/* Team 2 bans */}
          <div className="text-right">
            <div className="text-[7px] font-mono text-muted-foreground/35 uppercase tracking-widest mb-2 font-bold truncate">
              {team2Name}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {bansTeam2.length === 0 ? (
                <span className="text-[9px] font-mono text-muted-foreground/20">—</span>
              ) : (
                bansTeam2.map((b, i) => <BanTile key={i} brawler={b.brawler} imageUrl={b.imageUrl} size="md" />)
              )}
            </div>
          </div>
        </div>
      ) : hasUnknown ? (
        <div className="flex flex-wrap gap-2 justify-center">
          {bansUnknown.map((b, i) => <BanTile key={i} brawler={b.brawler} imageUrl={b.imageUrl} size="md" />)}
        </div>
      ) : null}
    </div>
  );
}

/* ── Single game card ────────────────────────────────────────────── */
export function SetGameCard({
  game,
  gameIndex,
  highlighted,
  teams,
  isFirst = false,
}: {
  key?: any;
  game: GameRecord;
  gameIndex: number;
  highlighted: boolean;
  teams?: ProTeamMeta[];
  isFirst?: boolean;
}) {
  const t1Won = game.winner === "team1";
  const t2Won = game.winner === "team2";
  const hasBans =
    game.bansTeam1.length > 0 ||
    game.bansTeam2.length > 0 ||
    game.bansUnknown.length > 0;

  const modeColor = MODE_COLOR[game.mode] ?? "#6b7280";
  const t1Logo = teams ? findTeamLogo(game.team1Name, game.team1Code, teams) : null;
  const t2Logo = teams ? findTeamLogo(game.team2Name, game.team2Code, teams) : null;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        highlighted
          ? "border-primary/50 ring-2 ring-primary/15 shadow-[0_0_20px_rgba(59,141,245,0.08)]"
          : isFirst
          ? "border-border/50 shadow-md"
          : "border-border/30 bg-black/10"
      }`}
    >
      {/* ── Game header bar ── */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/20"
        style={{ background: `linear-gradient(135deg, ${modeColor}18 0%, #00000055 100%)` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {highlighted && (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          )}
          {isFirst && !highlighted && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 shrink-0" />
          )}
          <span className="text-[9px] font-mono font-black text-muted-foreground/50 uppercase tracking-widest shrink-0">
            Set {gameIndex + 1}
          </span>
          <span className="text-base leading-none shrink-0">{MODE_EMOJI[game.mode] ?? "🎮"}</span>
          <span
            className="text-[11px] font-mono font-bold truncate"
            style={{ color: modeColor }}
          >
            {game.map}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Only show score for scrims (manually entered scoreline); Matcherino scores are raw
              in-game metrics (gem counts, heist HP, etc.) that would be confusing here. */}
          {game.source === "scrim" && game.score && (
            <span className="text-xs font-black font-mono text-foreground/50 tabular-nums">
              {game.score}
            </span>
          )}
          <span className="text-[9px] font-mono text-muted-foreground/30">
            {new Date(game.date).toLocaleDateString("de-DE")}
          </span>
        </div>
      </div>

      {/* ── Bans ── */}
      {hasBans && (
        <BansRow
          bansTeam1={game.bansTeam1}
          bansTeam2={game.bansTeam2}
          bansUnknown={game.bansUnknown}
          team1Name={game.team1Name}
          team2Name={game.team2Name}
        />
      )}

      {/* ── Picks — two columns ── */}
      <div className="grid grid-cols-2 divide-x divide-border/15">
        {/* Team 1 */}
        <div className={`p-4 ${game.winner && !t1Won ? "opacity-45" : ""}`}>
          <TeamHeader
            name={game.team1Name}
            logo={t1Logo}
            won={t1Won}
          />
          <div className="space-y-2.5">
            {game.team1Picks.map((p, i) => (
              <PickTile key={i} pick={p} isWinner={t1Won} />
            ))}
            {game.team1Picks.length === 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/25">No pick data</span>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className={`p-4 ${game.winner && !t2Won ? "opacity-45" : ""}`}>
          <TeamHeader
            name={game.team2Name}
            logo={t2Logo}
            won={t2Won}
            reversed
          />
          <div className="space-y-2.5">
            {game.team2Picks.map((p, i) => (
              <PickTile key={i} pick={p} isWinner={t2Won} reversed />
            ))}
            {game.team2Picks.length === 0 && (
              <div className="text-[10px] font-mono text-muted-foreground/25 text-right">
                No pick data
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Full match detail (series header + individual games) ─────────── */
export function MatchDetailContent({
  baseGame,
  seriesGames,
  teams,
  selectedBrawler,
  selectedMap,
}: {
  baseGame: GameRecord;
  seriesGames: GameRecord[];
  teams: ProTeamMeta[];
  selectedBrawler: string | null;
  selectedMap: string;
}) {
  const isScrim = baseGame.source === "scrim";
  const t1Logo = findTeamLogo(baseGame.team1Name, baseGame.team1Code, teams);
  const t2Logo = findTeamLogo(baseGame.team2Name, baseGame.team2Code, teams);
  const t1wins = seriesGames.filter((g) => g.winner === "team1").length;
  const t2wins = seriesGames.filter((g) => g.winner === "team2").length;
  const seriesWinner = t1wins > t2wins ? "team1" : t2wins > t1wins ? "team2" : null;

  function isHighlighted(game: GameRecord): boolean {
    const bMatch =
      !selectedBrawler ||
      [...game.team1Picks, ...game.team2Picks].some(
        (p) => p.brawler.toLowerCase() === selectedBrawler.toLowerCase()
      );
    const mMatch =
      !selectedMap || game.map.toLowerCase() === selectedMap.toLowerCase();
    return (!!selectedBrawler || !!selectedMap) && bMatch && mMatch;
  }

  // Sort: highlighted games first (the one with the selected brawler), then rest in order
  const sortedGames = selectedBrawler
    ? [
        ...seriesGames.filter((g) => isHighlighted(g)),
        ...seriesGames.filter((g) => !isHighlighted(g)),
      ]
    : seriesGames;

  // For scrims: just show the single game card without series header
  if (isScrim) {
    const game = seriesGames[0] ?? baseGame;
    return (
      <div className="space-y-4">
        {/* Meta badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {game.roundName && (
            <Badge
              variant="outline"
              className="text-[9px] font-mono border-blue-500/40 text-blue-300 flex items-center gap-1"
            >
              <Trophy className="w-2.5 h-2.5" /> {game.roundName}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[8px] font-mono border-orange-600/40 text-orange-400"
          >
            Scrim
          </Badge>
          <span className="text-[9px] font-mono text-muted-foreground/35">
            {new Date(game.date).toLocaleDateString("de-DE")}
          </span>
        </div>
        <SetGameCard
          game={game}
          gameIndex={0}
          highlighted={false}
          teams={teams}
          isFirst
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Series header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Team 1 */}
        <div className={`flex items-center gap-2.5 flex-1 min-w-0 ${seriesWinner === "team2" ? "opacity-40" : ""}`}>
          {t1Logo ? (
            <img
              src={t1Logo}
              alt=""
              className="w-11 h-11 object-contain rounded-xl bg-black/20 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-muted-foreground/30" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-black font-mono text-foreground truncate">{baseGame.team1Name}</div>
            {seriesWinner === "team1" && (
              <div className="text-[9px] font-mono font-black text-green-400 tracking-widest uppercase">Series Win</div>
            )}
          </div>
        </div>

        {/* Score block */}
        {seriesGames.length > 1 && (
          <div className="flex items-center gap-2.5 px-5 py-2.5 bg-black/30 rounded-xl border border-border/20 shrink-0">
            <span
              className={`text-3xl font-black font-mono tabular-nums ${
                t1wins > t2wins ? "text-green-400" : t1wins < t2wins ? "text-red-400/60" : "text-foreground/40"
              }`}
            >
              {t1wins}
            </span>
            <span className="text-xs font-mono text-muted-foreground/25 uppercase tracking-widest">–</span>
            <span
              className={`text-3xl font-black font-mono tabular-nums ${
                t2wins > t1wins ? "text-green-400" : t2wins < t1wins ? "text-red-400/60" : "text-foreground/40"
              }`}
            >
              {t2wins}
            </span>
          </div>
        )}

        {/* Team 2 */}
        <div className={`flex items-center gap-2.5 flex-1 min-w-0 justify-end ${seriesWinner === "team1" ? "opacity-40" : ""}`}>
          <div className="min-w-0 text-right">
            <div className="text-sm font-black font-mono text-foreground truncate">{baseGame.team2Name}</div>
            {seriesWinner === "team2" && (
              <div className="text-[9px] font-mono font-black text-green-400 tracking-widest uppercase">Series Win</div>
            )}
          </div>
          {t2Logo ? (
            <img
              src={t2Logo}
              alt=""
              className="w-11 h-11 object-contain rounded-xl bg-black/20 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex items-center gap-2 flex-wrap -mt-2">
        {baseGame.roundName && (
          <Badge
            variant="outline"
            className="text-[9px] font-mono border-blue-500/40 text-blue-300 flex items-center gap-1"
          >
            <Trophy className="w-2.5 h-2.5" /> {baseGame.roundName}
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[8px] font-mono border-blue-600/40 text-blue-400"
        >
          Matcherino
        </Badge>
        <span className="text-[9px] font-mono text-muted-foreground/35">
          {new Date(baseGame.date).toLocaleDateString("de-DE")}
        </span>
      </div>

      {/* ── Individual game cards — highlighted (selected brawler's game) first ── */}
      <div className="space-y-4">
        {sortedGames.map((game, idx) => (
          <SetGameCard
            key={game.id}
            game={game}
            gameIndex={seriesGames.indexOf(game)}
            highlighted={isHighlighted(game)}
            isFirst={idx === 0 && !!selectedBrawler}
            teams={teams}
          />
        ))}
      </div>

      {/* Highlight hint */}
      {(selectedBrawler || selectedMap) && seriesGames.some((g) => isHighlighted(g)) && (
        <div className="flex items-center gap-2 text-[9px] font-mono text-primary/50 pt-1">
          <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
          Filter aktiv
          {selectedBrawler && ` · ${displayName(selectedBrawler)}`}
          {selectedBrawler && selectedMap && " +"}
          {selectedMap && ` ${selectedMap}`}
        </div>
      )}
    </div>
  );
}

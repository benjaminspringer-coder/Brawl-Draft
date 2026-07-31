import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, scrimsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

type DraftEntry = { team: string; value: string; imageUrl: string | null; type: string; playerName?: string | null };
type MapDraft = {
  mapName: string; gameMode: string | null; winner: string | null;
  team1Score: number | null; team2Score: number | null;
  picks: DraftEntry[]; bans: DraftEntry[];
};

type BrawlerStatsMap = Map<string, {
  picks: number; bans: number; wins: number; losses: number;
  byMode: Map<string, { games: number; wins: number }>;
  counters: Map<string, { games: number; wins: number }>;
  teammates: Map<string, { games: number; wins: number }>;
  timeline: Map<string, { games: number; wins: number }>;
}>;

function getBrawlerKey(name: unknown): string | null {
  if (!name || typeof name !== "string") return null;
  const k = name.trim().toUpperCase();
  return k || null;
}

// Normalise mode strings to camelCase regardless of source format.
// Matcherino uses "BOUNTY", "BRAWL BALL", "GEM GRAB", "HOT ZONE", "BRAWL BALL", "KNOCKOUT"
// Scrims use camelCase already.
function normalizeMode(mode: unknown): string {
  if (!mode || typeof mode !== "string") return "";
  const m = mode.trim().toLowerCase().replace(/\s+/g, "");
  switch (m) {
    case "bounty":              return "bounty";
    case "heist":               return "heist";
    case "hotzone":             return "hotZone";
    case "brawlball":           return "brawlBall";
    case "gemgrab":             return "gemGrab";
    case "knockout":            return "knockout";
    // already camelCase variants
    case "hotzone_":            return "hotZone";
    default:                    return m;
  }
}

function initBrawler(stats: BrawlerStatsMap, name: string) {
  if (!stats.has(name)) {
    stats.set(name, {
      picks: 0, bans: 0, wins: 0, losses: 0,
      byMode: new Map(),
      counters: new Map(),
      teammates: new Map(),
      timeline: new Map(),
    });
  }
  return stats.get(name)!;
}

function incMode(modeMap: Map<string, { games: number; wins: number }>, mode: string, won: boolean) {
  if (!mode) return;
  if (!modeMap.has(mode)) modeMap.set(mode, { games: 0, wins: 0 });
  const m = modeMap.get(mode)!;
  m.games++;
  if (won) m.wins++;
}

function incMap<K>(m: Map<K, { games: number; wins: number }>, key: K, won: boolean) {
  if (!m.has(key)) m.set(key, { games: 0, wins: 0 });
  const v = m.get(key)!;
  v.games++;
  if (won) v.wins++;
}

router.get("/brawler-stats", async (req, res) => {
  try {
    const {
      brawler,
      map: mapFilter,
      mode: modeFilter,
      team: teamParam,
      player: playerParam,
      source = "all",
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    // Strip team prefix like "FUT|" or "FUT | " from a player name
    const stripPrefix = (n: string) => n.replace(/^[a-z0-9]+\s*\|\s*/i, "").trim();

    const fromTime = dateFrom ? new Date(dateFrom + "T00:00:00.000Z").getTime() : null;
    const toTime = dateTo ? new Date(dateTo + "T23:59:59.999Z").getTime() : null;
    const inDateRange = (d: Date | string | null | undefined) => {
      if (fromTime == null && toTime == null) return true;
      if (!d) return false;
      const t = new Date(d).getTime();
      if (Number.isNaN(t)) return false;
      if (fromTime != null && t < fromTime) return false;
      if (toTime != null && t > toTime) return false;
      return true;
    };

    // Support multiple comma-separated values for team and player filters
    const teamFilters = teamParam ? teamParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    // Strip team prefixes from player filters so "FUT|Guesti" and "FUT | Guesti" both match "guesti"
    const playerFilters = playerParam
      ? playerParam.split(",").map((s) => stripPrefix(s.trim().toLowerCase())).filter(Boolean)
      : [];

    const stats: BrawlerStatsMap = new Map();
    let totalSets = 0;

    if (source === "all" || source === "matcherino") {
      const allMatches = await db.select().from(matchesTable);

      for (const match of allMatches) {
        if (!inDateRange(match.createdAt)) continue;
        const maps = (match.maps ?? []) as MapDraft[];
        for (const setData of maps) {
          if (mapFilter && setData.mapName !== mapFilter) continue;
          const mode = normalizeMode(setData.gameMode);
          if (modeFilter && mode !== modeFilter) continue;
          totalSets++;

          const picks = setData.picks ?? [];
          const bans = setData.bans ?? [];
          const winner = setData.winner;
          const dateKey = match.createdAt ? new Date(match.createdAt).toISOString().slice(0, 10) : "unknown";

          const t1Picks = picks.filter((p) => p.team === match.team1Name);
          const t2Picks = picks.filter((p) => p.team === match.team2Name);
          const t1Won = winner === match.team1Name;
          const t2Won = winner === match.team2Name;

          // Track whether this set contributed picks (respects team/player filters)
          let setContributed = false;

          // Pass teamName explicitly so filter works even if teamPicks is empty
          const processTeam = (teamPicks: DraftEntry[], oppPicks: DraftEntry[], won: boolean, teamName: string) => {
            if (teamFilters.length > 0) {
              const matchesTeam = teamFilters.some((f) =>
                teamName.toLowerCase().includes(f)
              );
              if (!matchesTeam) return;
            }
            if (playerFilters.length > 0) {
              const hasPlayer = playerFilters.some((f) =>
                teamPicks.some((p) => {
                  const pn = stripPrefix(p.playerName?.toLowerCase() ?? "");
                  return pn.includes(f) || f.includes(pn);
                })
              );
              if (!hasPlayer) return;
            }
            // Skip sets with no actual pick data for this team
            if (teamPicks.length === 0) return;

            setContributed = true;

            const teamBrawlers = teamPicks.map((p) => getBrawlerKey(p.value)).filter((k): k is string => k !== null);
            const oppBrawlers = oppPicks.map((p) => getBrawlerKey(p.value)).filter((k): k is string => k !== null);

            for (const bk of teamBrawlers) {
              const s = initBrawler(stats, bk);
              s.picks++;
              if (won) s.wins++; else s.losses++;
              incMode(s.byMode, mode, won);
              incMap(s.timeline, dateKey, won);
              for (const tb of teamBrawlers) {
                if (tb !== bk) incMap(s.teammates, tb, won);
              }
              for (const ob of oppBrawlers) {
                incMap(s.counters, ob, !won);
              }
            }
          };

          processTeam(t1Picks, t2Picks, t1Won, match.team1Name ?? "");
          processTeam(t2Picks, t1Picks, t2Won, match.team2Name ?? "");

          // Only count bans (and increment totalSets) for sets that passed the filters
          const setIsRelevant = (teamFilters.length === 0 && playerFilters.length === 0) ? true : setContributed;
          if (!setIsRelevant) {
            // This set didn't match the team/player filter — undo the totalSets increment
            totalSets--;
            continue;
          }

          for (const ban of bans) {
            const bk = getBrawlerKey(ban.value);
            if (!bk) continue;
            const s = initBrawler(stats, bk);
            s.bans++;
          }
        }
      }
    }

    if (source === "all" || source === "scrims") {
      const allScrims = await db.select().from(scrimsTable);

      for (const scrim of allScrims) {
        if ((scrim.region || "EMEA") !== "EMEA") continue;
        if (!inDateRange(scrim.time)) continue;
        if (mapFilter && scrim.map !== mapFilter) continue;
        const mode = normalizeMode(scrim.mode);
        if (modeFilter && mode !== modeFilter) continue;

        const t1 = (scrim.team1Players ?? []) as any[];
        const t2 = (scrim.team2Players ?? []) as any[];
        const dateKey = scrim.time ? new Date(scrim.time).toISOString().slice(0, 10) : "unknown";

        const t1Won = scrim.winnerTeamCode === scrim.team1Code;
        const t2Won = scrim.winnerTeamCode === scrim.team2Code;

        let scrimSetContributed = false;

        const processScrimTeam = (team: any[], opp: any[], won: boolean, teamCode: string | null, teamName: string | null) => {
          if (teamFilters.length > 0) {
            const matchesTeam = teamFilters.some((f) =>
              teamName?.toLowerCase().includes(f) ||
              teamCode?.toLowerCase() === f
            );
            if (!matchesTeam) return;
          }
          if (playerFilters.length > 0) {
            const hasPlayer = playerFilters.some((f) =>
              team.some((p) => {
                const pn = stripPrefix(p.name?.toLowerCase() ?? "");
                return pn.includes(f) || f.includes(pn);
              })
            );
            if (!hasPlayer) return;
          }

          scrimSetContributed = true;

          const teamBrawlers = team.map((p) => getBrawlerKey(p.brawler)).filter((k): k is string => k !== null);
          const oppBrawlers = opp.map((p) => getBrawlerKey(p.brawler)).filter((k): k is string => k !== null);

          for (const bk of teamBrawlers) {
            const s = initBrawler(stats, bk);
            s.picks++;
            if (won) s.wins++; else s.losses++;
            incMode(s.byMode, mode, won);
            incMap(s.timeline, dateKey, won);
            for (const tb of teamBrawlers) {
              if (tb !== bk) incMap(s.teammates, tb, won);
            }
            for (const ob of oppBrawlers) {
              incMap(s.counters, ob, !won);
            }
          }
        };

        processScrimTeam(t1, t2, t1Won, scrim.team1Code, scrim.team1Name);
        processScrimTeam(t2, t1, t2Won, scrim.team2Code, scrim.team2Name);

        // Only count this scrim as a set if it passed team/player filters
        if (scrimSetContributed || (teamFilters.length === 0 && playerFilters.length === 0)) {
          totalSets++;
        }
      }
    }

    const brawlerStats = Array.from(stats.entries()).map(([name, s]) => {
      const games = s.picks;
      const winRate = games > 0 ? Math.round((s.wins / games) * 100 * 10) / 10 : 0;
      // presence = (picks + bans) / total map-sets played * 100
      const presence = totalSets > 0 ? Math.round(((s.picks + s.bans) / totalSets) * 100 * 10) / 10 : 0;

      const byMode = Array.from(s.byMode.entries()).map(([mode, m]) => ({
        mode,
        games: m.games,
        wins: m.wins,
        winRate: m.games > 0 ? Math.round((m.wins / m.games) * 100 * 10) / 10 : 0,
      })).sort((a, b) => b.games - a.games);

      // Bayesian-adjusted score: (wins + 1) / (games + 2) * 100
      // Penalises tiny samples — 1W/1G scores ~67 instead of 100
      const bayesScore = (wins: number, games: number) =>
        games > 0 ? ((wins + 1) / (games + 2)) * 100 : 0;

      const counterList = Array.from(s.counters.entries())
        .map(([brawler, c]) => ({
          brawler,
          games: c.games,
          winsAgainst: c.wins,
          winRate: c.games > 0 ? Math.round((c.wins / c.games) * 100 * 10) / 10 : 0,
          score: bayesScore(c.wins, c.games),
        }))
        .filter((c) => c.games >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      const teammateList = Array.from(s.teammates.entries())
        .map(([brawler, t]) => ({
          brawler,
          games: t.games,
          wins: t.wins,
          winRate: t.games > 0 ? Math.round((t.wins / t.games) * 100 * 10) / 10 : 0,
          score: bayesScore(t.wins, t.games),
        }))
        .filter((t) => t.games >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      const timeline = Array.from(s.timeline.entries())
        .map(([date, t]) => ({
          date,
          games: t.games,
          wins: t.wins,
          winRate: t.games > 0 ? Math.round((t.wins / t.games) * 100 * 10) / 10 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        name,
        picks: s.picks,
        bans: s.bans,
        wins: s.wins,
        losses: s.losses,
        winRate,
        presence,
        byMode,
        counters: counterList,
        teammates: teammateList,
        timeline,
      };
    }).sort((a, b) => b.picks - a.picks);

    if (brawler) {
      const found = brawlerStats.find((b) => b.name === getBrawlerKey(brawler));
      res.json(found ?? null);
      return;
    }

    const allBrawlers = brawlerStats.map((b) => b.name).sort();
    const allMaps = await db
      .selectDistinct({ map: scrimsTable.map })
      .from(scrimsTable);
    const matchMaps = await db.select({ maps: matchesTable.maps }).from(matchesTable);
    const matchMapNames = new Set<string>();
    for (const m of matchMaps) {
      const maps = (m.maps ?? []) as MapDraft[];
      for (const mp of maps) if (mp.mapName) matchMapNames.add(mp.mapName);
    }

    res.json({
      brawlers: brawlerStats,
      allBrawlers,
      allMaps: [...new Set([...allMaps.map((r) => r.map).filter(Boolean), ...matchMapNames])].sort(),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/brawler-stats error");
    res.status(500).json({ error: "Failed to compute brawler stats" });
  }
});

type GameRecord = {
  id: string;
  source: "matcherino" | "scrim";
  date: string;
  mode: string;
  map: string;
  team1Name: string;
  team2Name: string;
  team1Code: string | null;
  team2Code: string | null;
  winner: "team1" | "team2" | null;
  score: string | null;
  team1Picks: { brawler: string; player: string | null; imageUrl: string | null }[];
  team2Picks: { brawler: string; player: string | null; imageUrl: string | null }[];
  bansTeam1: { brawler: string; imageUrl: string | null }[];
  bansTeam2: { brawler: string; imageUrl: string | null }[];
  bansUnknown: { brawler: string; imageUrl: string | null }[];
  roundName: string | null;
};

router.get("/brawler-stats/games", async (req, res) => {
  try {
    const {
      brawler,
      map: mapFilter,
      mode: modeFilter,
      team: teamParam,
      player: playerParam,
      source = "all",
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    const stripPrefix = (n: string) => n.replace(/^[a-z0-9]+\s*\|\s*/i, "").trim();

    const teamFilters = teamParam ? teamParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    const playerFilters = playerParam
      ? playerParam.split(",").map((s) => stripPrefix(s.trim().toLowerCase())).filter(Boolean)
      : [];
    const brawlerKey = brawler ? getBrawlerKey(brawler) : null;

    const fromTime = dateFrom ? new Date(dateFrom + "T00:00:00.000Z").getTime() : null;
    const toTime = dateTo ? new Date(dateTo + "T23:59:59.999Z").getTime() : null;
    const inDateRange = (d: Date | string | null | undefined) => {
      if (fromTime == null && toTime == null) return true;
      if (!d) return false;
      const t = new Date(d).getTime();
      if (Number.isNaN(t)) return false;
      if (fromTime != null && t < fromTime) return false;
      if (toTime != null && t > toTime) return false;
      return true;
    };

    const teamMatches = (teamName: string | null | undefined, teamCode?: string | null) => {
      if (teamFilters.length === 0) return true;
      return teamFilters.some(
        (f) => (teamName?.toLowerCase().includes(f) ?? false) || teamCode?.toLowerCase() === f
      );
    };
    const playerMatches = (names: string[]) => {
      if (playerFilters.length === 0) return true;
      return playerFilters.some((f) =>
        names.some((n) => {
          const pn = stripPrefix(n.toLowerCase());
          return pn.includes(f) || f.includes(pn);
        })
      );
    };

    const games: GameRecord[] = [];

    if (source === "all" || source === "matcherino") {
      const allMatches = await db.select().from(matchesTable);

      for (const match of allMatches) {
        if (!inDateRange(match.createdAt)) continue;
        const maps = (match.maps ?? []) as MapDraft[];
        maps.forEach((setData, idx) => {
          if (mapFilter && setData.mapName !== mapFilter) return;
          const mode = normalizeMode(setData.gameMode);
          if (modeFilter && mode !== modeFilter) return;

          const picks = setData.picks ?? [];
          const bans = setData.bans ?? [];
          const t1Picks = picks.filter((p) => p.team === match.team1Name);
          const t2Picks = picks.filter((p) => p.team === match.team2Name);
          const t1Brawlers = t1Picks.map((p) => getBrawlerKey(p.value)).filter((k): k is string => !!k);
          const t2Brawlers = t2Picks.map((p) => getBrawlerKey(p.value)).filter((k): k is string => !!k);

          if (brawlerKey && !t1Brawlers.includes(brawlerKey) && !t2Brawlers.includes(brawlerKey)) return;

          const t1Names = t1Picks.map((p) => p.playerName ?? "").filter(Boolean);
          const t2Names = t2Picks.map((p) => p.playerName ?? "").filter(Boolean);

          const t1Team = teamMatches(match.team1Name) && playerMatches(t1Names);
          const t2Team = teamMatches(match.team2Name) && playerMatches(t2Names);
          if ((teamFilters.length > 0 || playerFilters.length > 0) && !t1Team && !t2Team) return;

          const winner = setData.winner;
          const winnerSide: "team1" | "team2" | null =
            winner === match.team1Name ? "team1" : winner === match.team2Name ? "team2" : null;
          const score =
            setData.team1Score != null && setData.team2Score != null
              ? `${setData.team1Score}-${setData.team2Score}`
              : null;
          const dateKey = match.createdAt ? new Date(match.createdAt).toISOString() : "";

          const bansTeam1: { brawler: string; imageUrl: string | null }[] = [];
          const bansTeam2: { brawler: string; imageUrl: string | null }[] = [];
          const bansUnknown: { brawler: string; imageUrl: string | null }[] = [];
          for (const b of bans) {
            const bk = getBrawlerKey(b.value);
            if (!bk) continue;
            const entry = { brawler: bk, imageUrl: b.imageUrl ?? null };
            if (b.team === match.team1Name) bansTeam1.push(entry);
            else if (b.team === match.team2Name) bansTeam2.push(entry);
            else bansUnknown.push(entry);
          }

          games.push({
            id: `m-${match.id}-${idx}`,
            source: "matcherino",
            date: dateKey,
            mode,
            map: setData.mapName,
            team1Name: match.team1Name ?? "Team 1",
            team2Name: match.team2Name ?? "Team 2",
            team1Code: null,
            team2Code: null,
            winner: winnerSide,
            score,
            team1Picks: t1Picks.map((p) => ({ brawler: getBrawlerKey(p.value) ?? "", player: p.playerName ?? null, imageUrl: p.imageUrl ?? null })).filter((p) => p.brawler),
            team2Picks: t2Picks.map((p) => ({ brawler: getBrawlerKey(p.value) ?? "", player: p.playerName ?? null, imageUrl: p.imageUrl ?? null })).filter((p) => p.brawler),
            bansTeam1: bansTeam1,
            bansTeam2: bansTeam2,
            bansUnknown: bansUnknown,
            roundName: match.roundName ?? null,
          });
        });
      }
    }

    if (source === "all" || source === "scrims") {
      const allScrims = await db.select().from(scrimsTable);

      for (const scrim of allScrims) {
        if ((scrim.region || "EMEA") !== "EMEA") continue;
        if (!inDateRange(scrim.time)) continue;
        if (mapFilter && scrim.map !== mapFilter) continue;
        const mode = normalizeMode(scrim.mode);
        if (modeFilter && mode !== modeFilter) continue;

        const t1 = (scrim.team1Players ?? []) as any[];
        const t2 = (scrim.team2Players ?? []) as any[];
        const t1Brawlers = t1.map((p) => getBrawlerKey(p.brawler)).filter((k): k is string => !!k);
        const t2Brawlers = t2.map((p) => getBrawlerKey(p.brawler)).filter((k): k is string => !!k);

        if (brawlerKey && !t1Brawlers.includes(brawlerKey) && !t2Brawlers.includes(brawlerKey)) continue;

        const t1Names = t1.map((p) => p.name ?? "").filter(Boolean);
        const t2Names = t2.map((p) => p.name ?? "").filter(Boolean);

        const t1Team = teamMatches(scrim.team1Name, scrim.team1Code) && playerMatches(t1Names);
        const t2Team = teamMatches(scrim.team2Name, scrim.team2Code) && playerMatches(t2Names);
        if ((teamFilters.length > 0 || playerFilters.length > 0) && !t1Team && !t2Team) continue;

        const winnerSide: "team1" | "team2" | null =
          scrim.winnerTeamCode === scrim.team1Code
            ? "team1"
            : scrim.winnerTeamCode === scrim.team2Code
            ? "team2"
            : null;

        games.push({
          id: `s-${scrim.id}`,
          source: "scrim",
          date: scrim.time ? new Date(scrim.time).toISOString() : "",
          mode,
          map: scrim.map,
          team1Name: scrim.team1Name ?? scrim.team1Code ?? "Team 1",
          team2Name: scrim.team2Name ?? scrim.team2Code ?? "Team 2",
          team1Code: scrim.team1Code ?? null,
          team2Code: scrim.team2Code ?? null,
          winner: winnerSide,
          score: scrim.scoreline ?? null,
          team1Picks: t1.map((p) => ({ brawler: getBrawlerKey(p.brawler) ?? "", player: p.name ?? null, imageUrl: p.brawler_id ? `https://cdn.brawlify.com/brawlers/borderless/${p.brawler_id}.png` : null })).filter((p) => p.brawler),
          team2Picks: t2.map((p) => ({ brawler: getBrawlerKey(p.brawler) ?? "", player: p.name ?? null, imageUrl: p.brawler_id ? `https://cdn.brawlify.com/brawlers/borderless/${p.brawler_id}.png` : null })).filter((p) => p.brawler),
          bansTeam1: [],
          bansTeam2: [],
          bansUnknown: [],
          roundName: null,
        });
      }
    }

    games.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    res.json({ games, total: games.length });
  } catch (err) {
    logger.error({ err }, "GET /api/brawler-stats/games error");
    res.status(500).json({ error: "Failed to load games" });
  }
});

export default router;

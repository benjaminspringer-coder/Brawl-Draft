import { db } from "@workspace/db";
import { scrimsTable, matchesTable, tournamentsTable } from "@workspace/db";
import { and, desc, eq, or, sql } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UGPlayer = {
  name: string;
  brawler: string | null;
  brawlerId?: number | null;
  imageUrl?: string | null;
  isSubstitute?: boolean;
};

export type UGBan = { brawler: string; imageUrl: string | null };

export type UnifiedGame = {
  id: string;
  source: "scrim" | "matcherino";
  time: string;
  mode: string;
  map: string;
  result: "W" | "L" | "D";
  opponentCode: string | null;
  opponentName: string;
  myTeamName: string;
  myPlayers: UGPlayer[];
  oppPlayers: UGPlayer[];
  myBans: UGBan[];
  oppBans: UGBan[];
  tournamentName: string | null;
  roundName: string | null;
  scoreline: string | null;
  isTournamentScrim: boolean;
};

// Matcherino stores game modes as display strings ("BRAWL BALL", "HOT ZONE");
// scrims store the camelCase key used throughout the frontend (brawlBall,
// hotZone). Normalize matcherino's mode to the same camelCase key so byMode
// aggregation and MODE_LABEL/MODE_ICONS lookups line up across both sources.
const MODE_DISPLAY_TO_KEY: Record<string, string> = {
  "BOUNTY": "bounty",
  "HEIST": "heist",
  "HOT ZONE": "hotZone",
  "HOTZONE": "hotZone",
  "BRAWL BALL": "brawlBall",
  "BRAWLBALL": "brawlBall",
  "GEM GRAB": "gemGrab",
  "GEMGRAB": "gemGrab",
  "KNOCKOUT": "knockout",
};

function normalizeMode(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toUpperCase();
  return MODE_DISPLAY_TO_KEY[key] ?? raw;
}

function stripPrefix(n: string): string {
  return (n ?? "").toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
}

function normalizeScrimPlayer(p: any): UGPlayer {
  return {
    name: p.name ?? "",
    brawler: p.brawler ?? null,
    brawlerId: p.brawlerId ?? null,
    isSubstitute: !!p.isSubstitute,
  };
}

function normalizeMatchPick(p: any): UGPlayer {
  return {
    name: p.playerName ?? "",
    brawler: p.value ?? null,
    imageUrl: p.imageUrl ?? null,
  };
}

function normalizeBan(b: any): UGBan {
  return { brawler: b.value ?? "", imageUrl: b.imageUrl ?? null };
}

function countPlayerOverlap(playersJson: any[], nameList: string[]): number {
  const names = (playersJson ?? []).map((p: any) => stripPrefix(p.name ?? "").toLowerCase());
  return nameList.filter((n) =>
    names.some((pn) =>
      pn === n ||
      // Player name contains roster name — only when roster name is long enough
      // to avoid "nob" matching "nobody_random" false-positives.
      // Deliberately removed the reverse direction (n.includes(pn)) which was
      // too loose: a 1-char player name would match any roster name.
      (n.length >= 3 && pn.includes(n))
    )
  ).length;
}

// ─── Scrim → UnifiedGame ────────────────────────────────────────────────────

function scrimToUnified(s: any, side: "team1" | "team2"): UnifiedGame {
  const isT1 = side === "team1";
  const myCode = isT1 ? s.team1Code : s.team2Code;
  const won = s.winnerTeamCode === myCode;
  const lost = s.winnerTeamCode !== null && !won;
  const t1 = (s.team1Players ?? []) as any[];
  const t2 = (s.team2Players ?? []) as any[];

  return {
    id: `scrim-${s.id}`,
    source: "scrim",
    time: new Date(s.time).toISOString(),
    mode: s.mode ?? "",
    map: s.map ?? "",
    result: won ? "W" : lost ? "L" : "D",
    opponentCode: isT1 ? s.team2Code : s.team1Code,
    opponentName: (isT1 ? s.team2Name : s.team1Name) ?? (isT1 ? s.team2Code : s.team1Code) ?? "?",
    myTeamName: (isT1 ? s.team1Name : s.team2Name) ?? "Custom",
    myPlayers: (isT1 ? t1 : t2).map(normalizeScrimPlayer),
    oppPlayers: (isT1 ? t2 : t1).map(normalizeScrimPlayer),
    myBans: [],
    oppBans: [],
    tournamentName: null,
    roundName: null,
    scoreline: s.scoreline ?? null,
    isTournamentScrim: !!s.isTournament,
  };
}

// ─── Matcherino match (flattened per map) → UnifiedGame[] ──────────────────

function matchToUnifiedGames(match: any, side: "team1" | "team2"): UnifiedGame[] {
  const isT1 = side === "team1";
  const myTeamName = isT1 ? match.team1Name : match.team2Name;
  const oppTeamName = isT1 ? match.team2Name : match.team1Name;
  const maps = (match.maps ?? []) as any[];

  return maps
    .filter((mp) => (mp.picks?.length ?? 0) > 0 || mp.action === "pick" || mp.action === "decider")
    .map((mp, idx) => {
      const won = mp.winner != null && mp.winner === myTeamName;
      const lost = mp.winner != null && mp.winner !== myTeamName;
      const picks = mp.picks ?? [];
      const bans = mp.bans ?? [];
      return {
        id: `match-${match.id}-${idx}`,
        source: "matcherino" as const,
        time: new Date(match.createdAt).toISOString(),
        mode: normalizeMode(mp.gameMode),
        map: mp.mapName ?? "",
        result: won ? "W" : lost ? "L" : "D",
        opponentCode: null,
        opponentName: oppTeamName ?? "?",
        myTeamName: myTeamName ?? "?",
        myPlayers: picks.filter((p: any) => p.team === myTeamName).map(normalizeMatchPick),
        oppPlayers: picks.filter((p: any) => p.team === oppTeamName).map(normalizeMatchPick),
        myBans: bans.filter((b: any) => b.team === myTeamName).map(normalizeBan),
        oppBans: bans.filter((b: any) => b.team === oppTeamName).map(normalizeBan),
        tournamentName: match.tournamentName ?? null,
        roundName: match.roundName ?? null,
        scoreline: match.score ?? null,
        isTournamentScrim: false,
      };
    });
}

async function loadAllMatchesWithTournament() {
  return db
    .select({
      id: matchesTable.id,
      tournamentId: matchesTable.tournamentId,
      tournamentName: tournamentsTable.name,
      team1Name: matchesTable.team1Name,
      team2Name: matchesTable.team2Name,
      winnerName: matchesTable.winnerName,
      score: matchesTable.score,
      roundName: matchesTable.roundName,
      maps: matchesTable.maps,
      createdAt: matchesTable.createdAt,
    })
    .from(matchesTable)
    .innerJoin(tournamentsTable, eq(matchesTable.tournamentId, tournamentsTable.id))
    .orderBy(desc(matchesTable.createdAt));
}

// ─── Public: games for a list of player names (custom team / player page) ──

export async function getGamesForPlayers(playerList: string[], minOv: number): Promise<UnifiedGame[]> {
  const games: UnifiedGame[] = [];

  const scrimRows = await db
    .select()
    .from(scrimsTable)
    .where(sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`)
    .orderBy(desc(scrimsTable.time))
    .limit(3000);

  for (const s of scrimRows) {
    const t1 = (s.team1Players ?? []) as any[];
    const t2 = (s.team2Players ?? []) as any[];
    const t1Ov = countPlayerOverlap(t1, playerList);
    const t2Ov = countPlayerOverlap(t2, playerList);
    if (t1Ov >= minOv && t1Ov >= t2Ov) games.push(scrimToUnified(s, "team1"));
    else if (t2Ov >= minOv) games.push(scrimToUnified(s, "team2"));
  }

  const allMatches = await loadAllMatchesWithTournament();
  for (const match of allMatches) {
    const maps = (match.maps ?? []) as any[];
    const t1PlayerSet = new Set<string>();
    const t2PlayerSet = new Set<string>();
    for (const m of maps) {
      for (const pick of m.picks ?? []) {
        if (!pick.playerName) continue;
        const pn = stripPrefix(pick.playerName);
        if (pick.team === match.team1Name) t1PlayerSet.add(pn);
        else t2PlayerSet.add(pn);
      }
    }
    const countOv = (set: Set<string>) =>
      playerList.filter((r) => Array.from(set).some((p) => p === r || p.includes(r) || r.includes(p))).length;
    const t1Ov = countOv(t1PlayerSet);
    const t2Ov = countOv(t2PlayerSet);
    if (t1Ov >= minOv && t1Ov >= t2Ov) games.push(...matchToUnifiedGames(match, "team1"));
    else if (t2Ov >= minOv) games.push(...matchToUnifiedGames(match, "team2"));
  }

  return games.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

// ─── Public: games for a pro team by code (+ roster names for fuzzy match) ─

export async function getGamesForTeamCode(code: string, rosterNames: string[]): Promise<UnifiedGame[]> {
  const games: UnifiedGame[] = [];
  const codeL = code.toLowerCase();
  const roster = rosterNames.map(stripPrefix).filter(Boolean);

  const scrimRows = await db
    .select()
    .from(scrimsTable)
    .where(
      and(
        or(eq(scrimsTable.team1Code, code), eq(scrimsTable.team2Code, code))!,
        sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`
      )
    )
    .orderBy(desc(scrimsTable.time));

  for (const s of scrimRows) {
    const side: "team1" | "team2" = s.team1Code === code ? "team1" : "team2";
    // When we have a known roster (≥2 players), require at least 1 to be present in
    // the scrim — prevents counting games where another team coincidentally uses the
    // same code (e.g. a random Matcherino team called "FUT" with no FUT players).
    if (roster.length >= 2) {
      const myPlayers = (side === "team1" ? s.team1Players : s.team2Players) as any[];
      if (countPlayerOverlap(myPlayers, roster) < 1) continue;
    }
    games.push(scrimToUnified(s, side));
  }
  const allMatches = await loadAllMatchesWithTournament();

  // Strict code match: team name must be exactly the code, or start with code+" |" (e.g. "FUT | Storm").
  // "FUT Academy" does NOT match "FUT" – avoids academy/B-team contamination.
  function isMainTeamCode(teamName: string | null | undefined, c: string): boolean {
    if (!teamName) return false;
    const n = teamName.toLowerCase().trim();
    if (n === c) return true;
    const rest = n.slice(c.length);
    return rest.startsWith(" |") || rest.startsWith("|");
  }

  for (const match of allMatches) {
    const directT1 = isMainTeamCode(match.team1Name, codeL);
    const directT2 = isMainTeamCode(match.team2Name, codeL);

    if (directT1) {
      games.push(...matchToUnifiedGames(match, "team1"));
      continue;
    }
    if (directT2) {
      games.push(...matchToUnifiedGames(match, "team2"));
      continue;
    }

    if (roster.length >= 2) {
      const maps = (match.maps ?? []) as any[];
      const t1PlayerSet = new Set<string>();
      const t2PlayerSet = new Set<string>();
      for (const m of maps) {
        for (const pick of m.picks ?? []) {
          if (!pick.playerName) continue;
          const pn = stripPrefix(pick.playerName);
          if (pick.team === match.team1Name) t1PlayerSet.add(pn);
          else t2PlayerSet.add(pn);
        }
      }
      const countOv = (set: Set<string>) =>
        roster.filter((r) => Array.from(set).some((p) => p === r || p.includes(r) || r.includes(p))).length;
      const t1Ov = countOv(t1PlayerSet);
      const t2Ov = countOv(t2PlayerSet);
      if (t1Ov >= 2 && t1Ov >= t2Ov) games.push(...matchToUnifiedGames(match, "team1"));
      else if (t2Ov >= 2) games.push(...matchToUnifiedGames(match, "team2"));
    }
  }

  return games.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

// ─── Aggregate stats from a unified game list ──────────────────────────────

export type UnifiedStats = {
  total: number; wins: number; losses: number; draws: number; winRate: number;
  bySource: { source: "scrim" | "matcherino"; games: number; wins: number; losses: number; wr: number }[];
  byMode: { mode: string; wins: number; losses: number; games: number; wr: number }[];
  byMap: { map: string; wins: number; losses: number; games: number; wr: number }[];
  byOpponent: { code: string; name: string; wins: number; losses: number; games: number; wr: number }[];
  byBrawler: { name: string; picks: number; bans: number; wins: number; losses: number; winRate: number }[];
  players: { name: string; games: number; wins: number; winRate: number; topBrawlers: { brawler: string; count: number; brawlerId?: number | null }[] }[];
  timeline: { week: string; wr: number; games: number; wins: number }[];
};

export function computeUnifiedStats(games: UnifiedGame[]): UnifiedStats {
  let wins = 0, losses = 0, draws = 0;
  const bySource: Record<string, { games: number; wins: number; losses: number }> = {
    scrim: { games: 0, wins: 0, losses: 0 },
    matcherino: { games: 0, wins: 0, losses: 0 },
  };
  const byMode: Record<string, { wins: number; losses: number }> = {};
  const byMap: Record<string, { wins: number; losses: number }> = {};
  const byOpponent: Record<string, { wins: number; losses: number; name: string }> = {};
  const byBrawler: Record<string, { picks: number; bans: number; wins: number; losses: number }> = {};
  const playerStats: Record<string, { name: string; brawlers: Record<string, number>; brawlerIds: Record<string, number>; games: number; wins: number }> = {};
  const byWeek: Record<string, { wins: number; total: number }> = {};

  for (const g of games) {
    const won = g.result === "W";
    const lost = g.result === "L";
    if (won) wins++; else if (lost) losses++; else draws++;

    bySource[g.source].games++;
    if (won) bySource[g.source].wins++; else if (lost) bySource[g.source].losses++;

    if (g.mode) {
      if (!byMode[g.mode]) byMode[g.mode] = { wins: 0, losses: 0 };
      if (won) byMode[g.mode].wins++; else if (lost) byMode[g.mode].losses++;
    }
    if (g.map) {
      if (!byMap[g.map]) byMap[g.map] = { wins: 0, losses: 0 };
      if (won) byMap[g.map].wins++; else if (lost) byMap[g.map].losses++;
    }
    const oppKey = g.opponentCode ?? g.opponentName;
    if (oppKey) {
      if (!byOpponent[oppKey]) byOpponent[oppKey] = { wins: 0, losses: 0, name: g.opponentName };
      if (won) byOpponent[oppKey].wins++; else if (lost) byOpponent[oppKey].losses++;
    }

    for (const p of g.myPlayers) {
      if (!p.brawler) continue;
      const key = p.brawler.toUpperCase();
      if (!byBrawler[key]) byBrawler[key] = { picks: 0, bans: 0, wins: 0, losses: 0 };
      byBrawler[key].picks++;
      if (won) byBrawler[key].wins++; else if (lost) byBrawler[key].losses++;
    }
    for (const b of g.myBans) {
      if (!b.brawler) continue;
      const key = b.brawler.toUpperCase();
      if (!byBrawler[key]) byBrawler[key] = { picks: 0, bans: 0, wins: 0, losses: 0 };
      byBrawler[key].bans++;
    }

    for (const p of g.myPlayers) {
      const pName = p.name;
      if (!pName) continue;
      if (!playerStats[pName]) playerStats[pName] = { name: pName, brawlers: {}, brawlerIds: {}, games: 0, wins: 0 };
      playerStats[pName].games++;
      if (won) playerStats[pName].wins++;
      if (p.brawler) {
        playerStats[pName].brawlers[p.brawler] = (playerStats[pName].brawlers[p.brawler] ?? 0) + 1;
        if (p.brawlerId) playerStats[pName].brawlerIds[p.brawler] = p.brawlerId;
      }
    }

    const d = new Date(g.time);
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = mon.toISOString().slice(0, 10);
    if (!byWeek[wk]) byWeek[wk] = { wins: 0, total: 0 };
    byWeek[wk].total++;
    if (won) byWeek[wk].wins++;
  }

  return {
    total: games.length, wins, losses, draws,
    winRate: games.length > 0 ? Math.round((wins / games.length) * 1000) / 10 : 0,
    bySource: (["scrim", "matcherino"] as const).map((s) => ({
      source: s, ...bySource[s],
      wr: bySource[s].games > 0 ? Math.round((bySource[s].wins / bySource[s].games) * 100) : 0,
    })),
    byMode: Object.entries(byMode)
      .map(([mode, s]) => ({ mode, ...s, games: s.wins + s.losses, wr: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
      .sort((a, b) => b.games - a.games),
    byMap: Object.entries(byMap)
      .map(([map, s]) => ({ map, ...s, games: s.wins + s.losses, wr: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
      .sort((a, b) => b.games - a.games),
    byOpponent: Object.entries(byOpponent)
      .map(([code, s]) => ({ code, ...s, games: s.wins + s.losses, wr: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
      .sort((a, b) => b.games - a.games),
    byBrawler: Object.entries(byBrawler)
      .map(([name, s]) => ({ name, ...s, winRate: s.picks > 0 ? Math.round((s.wins / s.picks) * 100) : 0 }))
      .sort((a, b) => b.picks - a.picks),
    players: Object.values(playerStats)
      .map((p) => ({
        name: p.name, games: p.games, wins: p.wins,
        winRate: p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0,
        topBrawlers: Object.entries(p.brawlers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([brawler, count]) => ({ brawler, count, brawlerId: p.brawlerIds[brawler] ?? null })),
      }))
      .sort((a, b) => b.games - a.games),
    timeline: Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-16)
      .map(([week, d]) => ({ week: week.slice(5), wr: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0, games: d.total, wins: d.wins })),
  };
}

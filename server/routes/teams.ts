import { Router } from "express";
import { db } from "@workspace/db";
import { scrimsTable, matchesTable, tournamentsTable } from "@workspace/db";
import { or, eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getGamesForPlayers, getGamesForTeamCode, computeUnifiedStats } from "../lib/unified-team-games";

const router = Router();

type DraftEntry = { team: string; value: string; imageUrl: string | null; type: string; playerName?: string | null };
type MapDraft = {
  mapName: string; gameMode: string | null; winner: string | null;
  team1Score: number | null; team2Score: number | null;
  picks: DraftEntry[]; bans: DraftEntry[];
};

// ─── GET /api/teams/search?q= ─────────────────────────────────────────────
router.get("/teams/search", async (req, res) => {
  try {
    const { q = "" } = req.query as Record<string, string>;
    const qTrimmed = q.trim();
    if (!qTrimmed || qTrimmed.length < 2) return res.json([]);

    const pattern = `%${qTrimmed.toLowerCase()}%`;

    const t1ByName = await db
      .selectDistinct({ code: scrimsTable.team1Code, name: scrimsTable.team1Name })
      .from(scrimsTable)
      .where(or(
        sql`lower(${scrimsTable.team1Name}) like ${pattern}`,
        sql`lower(${scrimsTable.team1Code}) like ${pattern}`
      )!)
      .limit(15);

    const t2ByName = await db
      .selectDistinct({ code: scrimsTable.team2Code, name: scrimsTable.team2Name })
      .from(scrimsTable)
      .where(or(
        sql`lower(${scrimsTable.team2Name}) like ${pattern}`,
        sql`lower(${scrimsTable.team2Code}) like ${pattern}`
      )!)
      .limit(15);

    const t1ByPlayer = await db
      .selectDistinct({ code: scrimsTable.team1Code, name: scrimsTable.team1Name })
      .from(scrimsTable)
      .where(sql`lower(${scrimsTable.team1Players}::text) like ${pattern}`)
      .limit(10);

    const t2ByPlayer = await db
      .selectDistinct({ code: scrimsTable.team2Code, name: scrimsTable.team2Name })
      .from(scrimsTable)
      .where(sql`lower(${scrimsTable.team2Players}::text) like ${pattern}`)
      .limit(10);

    const seen = new Set<string>();
    const results: { code: string; name: string; source: "scrims" }[] = [];

    for (const row of [...t1ByName, ...t2ByName, ...t1ByPlayer, ...t2ByPlayer]) {
      const code = row.code?.trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      results.push({ code, name: row.name ?? code, source: "scrims" });
    }

    const qL = qTrimmed.toLowerCase();
    results.sort((a, b) => {
      const aScore = a.name.toLowerCase().startsWith(qL) ? 0 : a.code.toLowerCase().startsWith(qL) ? 1 : 2;
      const bScore = b.name.toLowerCase().startsWith(qL) ? 0 : b.code.toLowerCase().startsWith(qL) ? 1 : 2;
      return aScore - bScore || a.name.localeCompare(b.name);
    });

    res.json(results.slice(0, 10));
  } catch (err) {
    logger.error({ err }, "GET /api/teams/search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── Fuzzy player-name matching ───────────────────────────────────────────────

let playerNameCache: { names: string[]; ts: number } | null = null;
const PLAYER_NAME_CACHE_TTL_MS = 5 * 60_000;

function cleanPlayerName(raw: string): string {
  return raw
    .replace(/^[A-Z0-9]+\s*\|\s*/i, "")           // strip team prefix e.g. "HMB|"
    .replace(/\p{Emoji_Presentation}/gu, "")        // strip emoji
    .replace(/[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, "") // strip variation selectors & skin tones
    .trim();
}

async function getAllPlayerNames(): Promise<string[]> {
  if (playerNameCache && Date.now() - playerNameCache.ts < PLAYER_NAME_CACHE_TTL_MS) {
    return playerNameCache.names;
  }
  const seen = new Set<string>();
  const [t1Rows, t2Rows, matchRows] = await Promise.all([
    db.select({ players: scrimsTable.team1Players }).from(scrimsTable),
    db.select({ players: scrimsTable.team2Players }).from(scrimsTable),
    db.select({ maps: matchesTable.maps }).from(matchesTable),
  ]);
  for (const row of [...t1Rows, ...t2Rows]) {
    for (const p of (row.players ?? []) as any[]) {
      if (p.name) {
        const clean = cleanPlayerName(p.name);
        if (clean) seen.add(clean);
      }
    }
  }
  for (const row of matchRows) {
    for (const m of (row.maps ?? []) as any[]) {
      for (const pick of m.picks ?? []) {
        if (pick.playerName) {
          const clean = cleanPlayerName(pick.playerName);
          if (clean) seen.add(clean);
        }
      }
    }
  }
  const names = Array.from(seen);
  playerNameCache = { names, ts: Date.now() };
  return names;
}

// Damerau-Levenshtein distance (handles transpositions, better for typos)
function damlev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) { d[i] = []; d[i][0] = i; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
}

// Bigram similarity (Dice coefficient) — very good for catching partial overlaps
function bigramSim(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const bg = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg2 = s[i] + s[i + 1];
      bg.set(bg2, (bg.get(bg2) ?? 0) + 1);
    }
    return bg;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let intersect = 0;
  for (const [k, v] of ba) {
    intersect += Math.min(v, bb.get(k) ?? 0);
  }
  return (2 * intersect) / (a.length - 1 + b.length - 1);
}

// Sliding window: best damlev of any substring of n with same length as q
function bestSubstringDamlev(n: string, q: string): number {
  if (q.length > n.length) return damlev(n, q);
  let best = Infinity;
  for (let i = 0; i <= n.length - q.length; i++) {
    const d = damlev(n.substring(i, i + q.length), q);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

function stripPrefix(raw: string): string {
  return raw.toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
}

function fuzzyNameScore(raw: string, q: string): number {
  const n = stripPrefix(raw);
  if (!q || q.length === 0) return 0;

  // Exact
  if (n === q) return 100;
  // Starts-with
  if (n.startsWith(q)) return 92;
  // Contains substring
  if (n.includes(q)) return 78;

  // Word boundary matches
  const words = n.split(/[\s|_\-]+/);
  for (const w of words) {
    if (w === q) return 88;
    if (w.startsWith(q)) return 72;
    if (w.includes(q)) return 58;
  }

  const qLen = q.length;
  // Tolerance scales with length: 1 for <=4, 2 for <=7, 3 for longer
  const tolerance = qLen <= 4 ? 1 : qLen <= 7 ? 2 : 3;

  if (qLen >= 2) {
    // Full DamLev on the whole name
    const lev = damlev(n, q);
    if (lev <= tolerance) return Math.max(10, 50 - lev * 10);

    // Sliding window: best substring match (handles "movees" → "mxvees")
    if (n.length >= qLen) {
      const subLev = bestSubstringDamlev(n, q);
      if (subLev <= tolerance) return Math.max(8, 38 - subLev * 8);
    }

    // Bigram Dice coefficient
    const dice = bigramSim(n, q);
    if (dice >= 0.6) return Math.round(dice * 35);
    if (dice >= 0.4) return Math.round(dice * 20);

    // DamLev ratio (for longer words where tolerance is tighter)
    const maxLen = Math.max(n.length, qLen);
    if (maxLen > 0 && lev / maxLen <= 0.4) return 12;
  }

  return 0;
}

// ─── GET /api/players/autocomplete?q= ────────────────────────────────────────
router.get("/players/autocomplete", async (req, res) => {
  try {
    const { q = "" } = req.query as Record<string, string>;
    const qTrimmed = q.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
    if (qTrimmed.length < 2) return res.json([]);

    const allNames = await getAllPlayerNames();
    const scored = allNames
      .map((name) => ({ name, score: fuzzyNameScore(name, qTrimmed) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    res.json(scored.slice(0, 25).map((r) => r.name));
  } catch (err) {
    logger.error({ err }, "GET /api/players/autocomplete error");
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// ─── helpers for custom team ──────────────────────────────────────────────────

function countPlayerOverlap(playersJson: any[], nameList: string[]): number {
  const names = playersJson.map((p: any) => (p.name ?? "").toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""));
  return nameList.filter((n) =>
    names.some((pn) => pn === n || pn.includes(n) || n.includes(pn))
  ).length;
}

async function fetchCustomScrims(playerList: string[], minOv: number) {
  const rows = await db
    .select()
    .from(scrimsTable)
    .where(sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`)
    .orderBy(desc(scrimsTable.time))
    .limit(3000);

  const results: (typeof rows[0] & { customSide: "team1" | "team2"; customWon: boolean; overlapCount: number })[] = [];

  for (const s of rows) {
    const t1 = (s.team1Players ?? []) as any[];
    const t2 = (s.team2Players ?? []) as any[];
    const t1Ov = countPlayerOverlap(t1, playerList);
    const t2Ov = countPlayerOverlap(t2, playerList);

    if (t1Ov >= minOv && t1Ov >= t2Ov) {
      results.push({ ...s, customSide: "team1", customWon: s.winnerTeamCode === s.team1Code, overlapCount: t1Ov });
    } else if (t2Ov >= minOv) {
      results.push({ ...s, customSide: "team2", customWon: s.winnerTeamCode === s.team2Code, overlapCount: t2Ov });
    }
  }

  return results;
}

// ─── GET /api/teams/custom/scrims ─────────────────────────────────────────────
router.get("/teams/custom/scrims", async (req, res) => {
  try {
    const { players = "", minOverlap = "2" } = req.query as Record<string, string>;
    const playerList = players.split(",").map((p) => p.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);
    const minOv = Math.max(1, Math.min(parseInt(minOverlap) || 2, playerList.length));
    if (playerList.length < 1) return res.json([]);

    const results = await fetchCustomScrims(playerList, minOv);
    res.json(results);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/custom/scrims error");
    res.status(500).json({ error: "Failed to fetch custom team scrims" });
  }
});

// ─── GET /api/teams/custom/games ──────────────────────────────────────────────
router.get("/teams/custom/games", async (req, res) => {
  try {
    const { players = "", minOverlap = "1" } = req.query as Record<string, string>;
    const playerList = players.split(",").map((p) => p.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);
    const minOv = Math.max(1, Math.min(parseInt(minOverlap) || 1, playerList.length));
    if (playerList.length < 1) return res.json([]);

    const games = await getGamesForPlayers(playerList, minOv);
    res.json(games);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/custom/games error");
    res.status(500).json({ error: "Failed to fetch custom games" });
  }
});

// ─── GET /api/teams/custom/stats ──────────────────────────────────────────────
router.get("/teams/custom/stats", async (req, res) => {
  try {
    const { players = "", minOverlap = "1" } = req.query as Record<string, string>;
    const rawPlayers = players.split(",").map((p) => p.trim()).filter(Boolean);
    const playerList = rawPlayers.map((p) => p.toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);
    const minOv = Math.max(1, Math.min(parseInt(minOverlap) || 1, playerList.length));
    if (playerList.length < 1) {
      return res.json({
        total: 0, wins: 0, losses: 0, draws: 0, winRate: 0,
        bySource: [], byMode: [], byMap: [], byOpponent: [], byBrawler: [], players: [], timeline: [],
        detectedTeamCode: null, detectedTeamName: null,
      });
    }

    const prefixCounts: Record<string, number> = {};
    for (const rp of rawPlayers) {
      const m = /^([A-Za-z0-9]+)\|/.exec(rp);
      if (m) prefixCounts[m[1].toUpperCase()] = (prefixCounts[m[1].toUpperCase()] || 0) + 1;
    }
    const topPrefix = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0];
    const detectedPrefix = topPrefix && topPrefix[1] >= Math.ceil(rawPlayers.length / 2) ? topPrefix[0] : null;

    const games = await getGamesForPlayers(playerList, minOv);
    const stats = computeUnifiedStats(games);

    const scrimTeamCounts: Record<string, { count: number; name: string | null }> = {};
    for (const g of games) {
      if (g.source !== "scrim") continue;
      const key = g.myTeamName;
      if (!key) continue;
      if (!scrimTeamCounts[key]) scrimTeamCounts[key] = { count: 0, name: key };
      scrimTeamCounts[key].count++;
    }
    const topScrimTeam = Object.entries(scrimTeamCounts).sort((a, b) => b[1].count - a[1].count)[0];
    const detectedTeamName = topScrimTeam ? topScrimTeam[1].name : detectedPrefix;
    const detectedTeamCode = detectedPrefix ?? (topScrimTeam ? topScrimTeam[0] : null);

    res.json({ ...stats, detectedTeamCode, detectedTeamName });
  } catch (err) {
    logger.error({ err }, "GET /api/teams/custom/stats error");
    res.status(500).json({ error: "Failed to compute custom team stats" });
  }
});

// ─── GET /api/teams/custom/matches ────────────────────────────────────────────
router.get("/teams/custom/matches", async (req, res) => {
  try {
    const { players = "", minOverlap = "2" } = req.query as Record<string, string>;
    const playerList = players.split(",").map((p) => p.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);
    const minOv = Math.max(1, Math.min(parseInt(minOverlap) || 2, playerList.length));
    if (playerList.length < 1) return res.json([]);

    const allMatches = await db
      .select({
        id: matchesTable.id,
        tournamentId: matchesTable.tournamentId,
        tournamentName: tournamentsTable.name,
        externalMatchId: matchesTable.externalMatchId,
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

    const results: any[] = [];

    for (const match of allMatches) {
      const maps = (match.maps ?? []) as MapDraft[];
      const t1PlayerSet = new Set<string>();
      const t2PlayerSet = new Set<string>();

      for (const m of maps) {
        for (const pick of m.picks ?? []) {
          if (!pick.playerName) continue;
          const pn = pick.playerName.toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
          if (pick.team === match.team1Name) t1PlayerSet.add(pn);
          else t2PlayerSet.add(pn);
        }
      }

      const countOv = (playerSet: Set<string>) =>
        playerList.filter((r) =>
          Array.from(playerSet).some((p) => p === r || p.includes(r) || r.includes(p))
        ).length;

      const t1Ov = countOv(t1PlayerSet);
      const t2Ov = countOv(t2PlayerSet);

      if (t1Ov >= minOv && t1Ov >= t2Ov) {
        results.push({ ...match, matchedSide: "team1", matchMethod: "players", overlapCount: t1Ov });
      } else if (t2Ov >= minOv) {
        results.push({ ...match, matchedSide: "team2", matchMethod: "players", overlapCount: t2Ov });
      }
    }

    res.json(results);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/custom/matches error");
    res.status(500).json({ error: "Failed to fetch custom team matches" });
  }
});

// ─── GET /api/teams/:code/info ────────────────────────────────────────────────
router.get("/teams/:code/info", async (req, res) => {
  try {
    const { code } = req.params;

    const latestT1 = await db
      .select({ code: scrimsTable.team1Code, name: scrimsTable.team1Name, players: scrimsTable.team1Players, time: scrimsTable.time })
      .from(scrimsTable)
      .where(and(eq(scrimsTable.team1Code, code), sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`))
      .orderBy(desc(scrimsTable.time))
      .limit(5);

    const latestT2 = await db
      .select({ code: scrimsTable.team2Code, name: scrimsTable.team2Name, players: scrimsTable.team2Players, time: scrimsTable.time })
      .from(scrimsTable)
      .where(and(eq(scrimsTable.team2Code, code), sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`))
      .orderBy(desc(scrimsTable.time))
      .limit(5);

    const all = [...latestT1, ...latestT2].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    if (all.length === 0) return res.json({ code, name: code, players: [], found: false });

    const playerMap = new Map<string, { name: string; brawler: string; brawlerId: number }>();
    for (const row of all) {
      const players = (row.players ?? []) as any[];
      for (const p of players) {
        if (p.name && !p.isSubstitute && !playerMap.has(p.name)) {
          playerMap.set(p.name, { name: p.name, brawler: p.brawler, brawlerId: p.brawlerId });
        }
      }
    }

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrimsTable)
      .where(or(eq(scrimsTable.team1Code, code), eq(scrimsTable.team2Code, code))!);

    res.json({ code, name: all[0].name ?? code, players: Array.from(playerMap.values()).slice(0, 8), totalScrims: Number(totalCount[0]?.count ?? 0), found: true });
  } catch (err) {
    logger.error({ err }, "GET /api/teams/:code/info error");
    res.status(500).json({ error: "Failed to get team info" });
  }
});

// ─── GET /api/teams/:code/scrims ──────────────────────────────────────────────
router.get("/teams/:code/scrims", async (req, res) => {
  try {
    const { code } = req.params;
    const { mode, map, limit = "500", roster = "" } = req.query as Record<string, string>;

    // Parse roster names the same way as the stats/games endpoints.
    const rosterNames = roster
      .split(",")
      .map((n) => n.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""))
      .filter(Boolean);

    const conditions: any[] = [
      or(eq(scrimsTable.team1Code, code), eq(scrimsTable.team2Code, code))!,
      sql`${scrimsTable.team2Code} is not null and ${scrimsTable.team2Code} != ''`,
    ];
    if (mode) conditions.push(eq(scrimsTable.mode, mode));
    if (map) conditions.push(eq(scrimsTable.map, map));

    const rows = await db
      .select()
      .from(scrimsTable)
      .where(and(...conditions))
      .orderBy(desc(scrimsTable.time))
      .limit(Math.min(parseInt(limit) || 500, 1000));

    // When a known roster is provided, drop scrims where none of its members appear.
    // This stops scrims from teams that coincidentally used the same code (e.g. a
    // random Matcherino lobby called "FUT" with zero actual FUT players).
    const filtered =
      rosterNames.length >= 2
        ? rows.filter((s: any) => {
            const myPlayers = (
              s.team1Code === code ? s.team1Players : s.team2Players
            ) as any[];
            const playerNames = (myPlayers ?? []).map((p: any) =>
              (p.name ?? "").toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")
            );
            // Require at least 1 known roster member in the scrim.
            return rosterNames.some((r) =>
              playerNames.some((pn: string) => pn === r || (r.length >= 3 && pn.includes(r)))
            );
          })
        : rows;

    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/:code/scrims error");
    res.status(500).json({ error: "Failed to fetch team scrims" });
  }
});

// ─── GET /api/teams/:code/matches ─────────────────────────────────────────────
router.get("/teams/:code/matches", async (req, res) => {
  try {
    const { code } = req.params;
    const { roster = "", name: nameHint = "" } = req.query as Record<string, string>;

    const rosterNames = roster
      .split(",")
      .map((n) => n.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, ""))
      .filter(Boolean);

    const allMatches = await db
      .select({
        id: matchesTable.id,
        tournamentId: matchesTable.tournamentId,
        tournamentName: tournamentsTable.name,
        externalMatchId: matchesTable.externalMatchId,
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

    const codeL = code.toLowerCase();
    const nameL = nameHint.toLowerCase();
    const results: any[] = [];

    for (const match of allMatches) {
      const t1L = (match.team1Name ?? "").toLowerCase();
      const t2L = (match.team2Name ?? "").toLowerCase();

      const directT1 = t1L.includes(codeL) || (nameL.length > 2 && t1L.includes(nameL));
      const directT2 = t2L.includes(codeL) || (nameL.length > 2 && t2L.includes(nameL));

      if (directT1) { results.push({ ...match, matchedSide: "team1", matchMethod: "direct" }); continue; }
      if (directT2) { results.push({ ...match, matchedSide: "team2", matchMethod: "direct" }); continue; }

      if (rosterNames.length >= 2) {
        const maps = (match.maps ?? []) as MapDraft[];
        const t1PlayerSet = new Set<string>();
        const t2PlayerSet = new Set<string>();

        for (const m of maps) {
          for (const pick of m.picks ?? []) {
            if (!pick.playerName) continue;
            const pn = pick.playerName.toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "");
            if (pick.team === match.team1Name) t1PlayerSet.add(pn);
            else t2PlayerSet.add(pn);
          }
        }

        const countOverlap = (playerSet: Set<string>) =>
          rosterNames.filter((r) => Array.from(playerSet).some((p) => p === r || p.includes(r) || r.includes(p))).length;

        const t1Overlap = countOverlap(t1PlayerSet);
        const t2Overlap = countOverlap(t2PlayerSet);

        if (t1Overlap >= 2) results.push({ ...match, matchedSide: "team1", matchMethod: "players", overlapCount: t1Overlap });
        else if (t2Overlap >= 2) results.push({ ...match, matchedSide: "team2", matchMethod: "players", overlapCount: t2Overlap });
      }
    }

    res.json(results);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/:code/matches error");
    res.status(500).json({ error: "Failed to fetch team matches" });
  }
});

// ─── GET /api/teams/:code/games ───────────────────────────────────────────────
router.get("/teams/:code/games", async (req, res) => {
  try {
    const { code } = req.params;
    const { roster = "" } = req.query as Record<string, string>;
    const rosterNames = roster.split(",").map((n) => n.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);

    const games = await getGamesForTeamCode(code, rosterNames);
    res.json(games);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/:code/games error");
    res.status(500).json({ error: "Failed to fetch team games" });
  }
});

// ─── GET /api/teams/:code/stats ───────────────────────────────────────────────
router.get("/teams/:code/stats", async (req, res) => {
  try {
    const { code } = req.params;
    const { roster = "" } = req.query as Record<string, string>;
    const rosterNames = roster.split(",").map((n) => n.trim().toLowerCase().replace(/^[a-z0-9]+\s*\|\s*/i, "")).filter(Boolean);

    const games = await getGamesForTeamCode(code, rosterNames);
    const stats = computeUnifiedStats(games);
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /api/teams/:code/stats error");
    res.status(500).json({ error: "Failed to compute team stats" });
  }
});

export default router;

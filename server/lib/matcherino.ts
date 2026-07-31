import { logger } from "./logger";

const BASE = "https://matcherino.com/__api";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; MatcherinoDraftViewer/1.0)",
    },
  });
  if (!res.ok) {
    throw new Error(`Matcherino API error ${res.status} for ${url}`);
  }
  const data = (await res.json()) as {
    status?: number;
    body?: unknown;
    error?: unknown;
  };
  if (data && typeof data === "object" && "status" in data) {
    if ((data.status as number) !== 200 && (data.status as number) !== 201) {
      throw new Error(`Matcherino API returned status ${data.status}`);
    }
    return data.body;
  }
  return data;
}

export interface ParsedUrl {
  /** Slug for /t/<slug> style URLs */
  slug?: string;
  /** Numeric tournament ID for /tournaments/<id> style URLs */
  numericId?: number;
  /** The canonical identifier stored in the DB */
  identifier: string;
}

export function parseMatcherinoUrl(url: string): ParsedUrl | null {
  // Format 1: https://matcherino.com/t/<slug>/...
  const slugMatch = url.match(/matcherino\.com\/t\/([^/?#]+)/);
  if (slugMatch) {
    const slug = slugMatch[1];
    return { slug, identifier: slug };
  }

  // Format 2: https://matcherino.com/<anything>/tournaments/<id>/...
  const idMatch = url.match(/matcherino\.com\/[^/]+\/tournaments\/(\d+)/);
  if (idMatch) {
    const numericId = parseInt(idMatch[1], 10);
    return { numericId, identifier: `id_${numericId}` };
  }

  // Format 3: direct numeric ID anywhere in path
  const directIdMatch = url.match(/matcherino\.com\/.*?\/(\d{5,})/);
  if (directIdMatch) {
    const numericId = parseInt(directIdMatch[1], 10);
    return { numericId, identifier: `id_${numericId}` };
  }

  return null;
}

/** @deprecated Use parseMatcherinoUrl instead */
export function parseSlugFromUrl(url: string): string | null {
  const parsed = parseMatcherinoUrl(url);
  return parsed?.slug ?? null;
}

// ---- Raw API shapes ----

interface RawBounty {
  id: number;
  name: string;
  gameName?: string;
  gameMode?: string;
  avatar?: string;
  shortlink?: string;
  startAt?: string | null;
  finalizedAt?: string | null;
  game?: { id: number; title: string; slug: string };
}

// ---- Daily Brawl Stars Events ----

// Matcherino region/org constants (verified against live API data)
const BRAWL_STARS_GAME_ID = 122;

// EMEA EU server IDs (gameRegionId field in the list API — explicitly set by the organizer).
// Determined by scanning confirmed EU Brawl Stars events (EU creators, European timezones):
//   14, 15, 17, 18, 25 → EU Germany server variants
//   26 → ME Riyadh server (also EMEA geographically, ignored per user preference)
// Non-EMEA for reference: 7=NA, 13=SA, 20=AP India, 21=AP HK, 22=AP SEA, 24=AP AU
const EMEA_REGION_IDS = new Set([14, 15, 17, 18, 25]);

// Featured = item.payouts is non-null. Supercell Featured (Bronze/Silver/Gold) events always
// configure prize payouts (winner pin etc.). Starter events have payouts: null.
// item.orgMemberships is NEVER returned by the list API — do not use it.
// item.isFeatured is also unreliable for Supercell Featured status.

// Scan up to 600 items (24 pages). Recurring events are created weeks ago (old IDs)
// but have today's startAt — the list API sorts by creation date, not startAt,
// so we need deep pagination to reliably find them.
const SCAN_OFFSETS = Array.from({ length: 24 }, (_, i) => i * 25); // 0,25,...,575

export interface DailyEvent {
  id: number;
  title: string;
  startAt: string | null;
  finalizedAt: string | null;
  matcherinoUrl: string;
  eventStatus: "upcoming" | "live" | "finished";
  players: number;
  regionId: number;
}

function deriveEventStatus(startAt: string | null, finalizedAt: string | null, bountyStatus?: string): "upcoming" | "live" | "finished" {
  if (finalizedAt || bountyStatus === "done") return "finished";
  if (!startAt) return "upcoming";
  const now = new Date();
  const start = new Date(startAt);
  if (start > now) return "upcoming";
  return "live";
}

/** Returns true when a bounty item passes the EMEA Featured filter.
 *
 * "Featured" = item.payouts is non-null. Supercell Featured (Bronze/Silver/Gold) events
 *   always configure prize payouts (winner pin etc.). Starter events have payouts: null.
 *
 * "EMEA" = item.gameRegionId is in EMEA_REGION_IDS. This is the game server region that
 *   the organizer explicitly selects when creating the tournament — the most direct signal.
 *   Using creator.gameRegion is unreliable: an EU-based creator can host APAC/NA events
 *   and the creator's profile region would still say "EU".
 */
function isEmeaFeatured(item: any): boolean {
  if (item.game?.id !== BRAWL_STARS_GAME_ID) return false;
  if (!item.payouts) return false;
  return EMEA_REGION_IDS.has(item.gameRegionId);
}

function bountyToEvent(item: any): DailyEvent {
  const shortlinkToken =
    typeof item.shortlink === "string"
      ? item.shortlink
      : (item.shortlink?.token ?? null);
  const matcherinoUrl = shortlinkToken
    ? `https://matcherino.com/t/${shortlinkToken}/overview`
    : `https://matcherino.com/supercell/tournaments/${item.id}/overview`;

  return {
    id: item.id,
    title: item.title || item.name || `Tournament ${item.id}`,
    startAt: item.startAt ?? null,
    finalizedAt: item.finalizedAt ?? null,
    matcherinoUrl,
    eventStatus: deriveEventStatus(item.startAt, item.finalizedAt, item.status),
    players: item.bracketPlayers ?? 0,
    regionId: item.gameRegionId ?? 0,
  };
}

export async function fetchDailyBrawlStarsEvents(): Promise<{ today: DailyEvent[]; yesterday: DailyEvent[] }> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = yest.toISOString().slice(0, 10);

  // Fetch all brawl-stars events and filter client-side. We cannot use isFeatured=true
  // as a server-side param because Supercell Featured events (orgMemberships orgId=1180,
  // tierNum>=2) often have item.isFeatured=false — that flag means something different.
  const pages = await Promise.allSettled(
    SCAN_OFFSETS.map((offset) =>
      fetchJson(
        `${BASE}/bounties/list?gameSlug=brawl-stars&pageSize=25&offset=${offset}`
      )
    )
  );

  const seen = new Set<number>();
  const allEvents: DailyEvent[] = [];

  for (const result of pages) {
    if (result.status === "rejected") continue;
    const data = result.value;
    const items: any[] = Array.isArray(data) ? data : [];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      const startDay: string = item.startAt?.slice(0, 10) ?? "";
      if (startDay !== todayStr && startDay !== yesterdayStr) continue;
      if (!isEmeaFeatured(item)) continue;
      seen.add(item.id);
      allEvents.push(bountyToEvent(item));
    }
  }

  logger.info(
    { todayCount: allEvents.filter((e) => e.startAt?.slice(0, 10) === todayStr).length,
      yesterdayCount: allEvents.filter((e) => e.startAt?.slice(0, 10) === yesterdayStr).length },
    "fetchDailyBrawlStarsEvents complete"
  );

  const statusOrder = { live: 0, upcoming: 1, finished: 2 };
  const sort = (a: DailyEvent, b: DailyEvent) =>
    statusOrder[a.eventStatus] - statusOrder[b.eventStatus] ||
    (a.startAt ?? "").localeCompare(b.startAt ?? "");

  return {
    today: allEvents.filter((e) => e.startAt?.slice(0, 10) === todayStr).sort(sort),
    yesterday: allEvents.filter((e) => e.startAt?.slice(0, 10) === yesterdayStr).sort(sort),
  };
}

// ---- EMEA Event Discovery via corestats.pro ----
//
// corestats.pro is a mirror of Matcherino bounty objects for Brawl Stars only.
// ALL tournaments on corestats are Supercell Featured — no payouts check needed.
// The only filter required is gameRegionId in EMEA_REGION_IDS.
// corestats does NOT reliably expose shortlinks, so we construct URLs via numeric ID.
// bracketStatus on corestats is often stale — always verify completion via Matcherino brackets API.

const CORESTATS_BASE = "https://corestats.pro/api";

export interface EmeaRangeEvent {
  id: number;
  title: string;
  startAt: string | null;
  matcherinoUrl: string;
  regionId: number;
}

/** Fetches EMEA Brawl Stars tournaments from corestats.pro for the last `days` days.
 *  corestats is paginated by startAt desc (roughly). We stop when all items on a page
 *  are older than our window. */
export async function fetchCorestatEmeaEvents(days: number): Promise<EmeaRangeEvent[]> {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const seen = new Set<number>();
  const results: EmeaRangeEvent[] = [];

  for (let page = 1; page <= 30; page++) {
    let items: any[];
    try {
      // Use direct fetch — corestats response shape differs from Matcherino's
      const res = await fetch(`${CORESTATS_BASE}/tournaments?page=${page}&limit=50`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BrawlAnalytics/1.0)" },
      });
      if (!res.ok) break;
      const raw = await res.json() as any;
      items = raw?.body?.contents ?? raw?.contents ?? (Array.isArray(raw) ? raw : []);
    } catch {
      break;
    }

    if (!items.length) break;

    let anyInWindow = false;
    for (const item of items) {
      if (!item.startAt) continue;
      const start = new Date(item.startAt);
      if (start > now) continue;
      if (start < since) continue;
      anyInWindow = true;

      if (item.gameId !== BRAWL_STARS_GAME_ID && item.game?.id !== BRAWL_STARS_GAME_ID) continue;
      if (!EMEA_REGION_IDS.has(item.gameRegionId)) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      // corestats rarely exposes shortlinks; use numeric ID URL as fallback
      const shortlinkToken =
        typeof item.shortlink === "string" ? item.shortlink : (item.shortlink?.token ?? null);
      const matcherinoUrl = shortlinkToken
        ? `https://matcherino.com/t/${shortlinkToken}/overview`
        : `https://matcherino.com/supercell/tournaments/${item.id}/overview`;

      results.push({
        id: item.id,
        title: item.title || item.name || `Tournament ${item.id}`,
        startAt: item.startAt,
        matcherinoUrl,
        regionId: item.gameRegionId ?? 0,
      });
    }

    // All items on this page are outside our window — no point going deeper
    if (!anyInWindow && items.every(t => !t.startAt || new Date(t.startAt) < since)) break;
  }

  logger.info({ days, count: results.length }, "fetchCorestatEmeaEvents complete");
  return results;
}

/** @deprecated Use fetchCorestatEmeaEvents instead — corestats is the preferred discovery source. */
export async function fetchEmeaFeaturedEventsInRange(days: number): Promise<EmeaRangeEvent[]> {
  return fetchCorestatEmeaEvents(days);
}

/** A tournament is only truly finished when EVERY match in its bracket(s) — including
 * the final — has status "done"/"completed". The bounty-level `status` field is NOT
 * a reliable signal: it can stay "in-progress" long after the event actually ended. */
export async function isBracketFullyComplete(bountyId: number): Promise<boolean> {
  const bracketsData = (await fetchJson(`${BASE}/brackets?bountyId=${bountyId}`)) as RawBracket[] | null;
  const brackets = Array.isArray(bracketsData) ? bracketsData : [];
  if (brackets.length === 0) return false;

  for (const bracket of brackets) {
    const matches = bracket.matches ?? [];
    if (matches.length === 0) return false;
    const allDone = matches.every((m) => m.status === "done" || m.status === "completed");
    if (!allDone) return false;
  }
  return true;
}

// ---- EMEA Event Search ----

export interface EmeaEventResult {
  id: number;
  title: string;
  startAt: string | null;
  finalizedAt: string | null;
  matcherinoUrl: string;
  identifier: string;
}

export async function searchEmeaFeaturedEvents(): Promise<EmeaEventResult[]> {
  const queries = ["EMEA Brawl Stars", "BSC EMEA", "Brawl Stars EMEA"];
  const seen = new Set<number>();
  const results: EmeaEventResult[] = [];

  for (const q of queries) {
    try {
      const url = `${BASE}/bounties/search?pageSize=30&q=${encodeURIComponent(q)}`;
      const data = (await fetchJson(url)) as {
        contents?: RawBounty[];
        itemCount?: number;
      };
      const items = data?.contents ?? [];
      for (const item of items) {
        // Only Brawl Stars (game id 122) + has finalizedAt (completed) + EMEA in title
        if (seen.has(item.id)) continue;
        const gameId = item.game?.id;
        if (gameId !== 122) continue;
        const displayName = (item as any).title ?? item.name ?? "";
        const titleLower = displayName.toLowerCase();
        if (!titleLower.includes("emea") && !titleLower.includes("bsc")) continue;
        if (!item.finalizedAt) continue; // only completed events
        seen.add(item.id);
        const identifier = item.shortlink ?? `id_${item.id}`;
        results.push({
          id: item.id,
          title: displayName,
          startAt: item.startAt ?? null,
          finalizedAt: item.finalizedAt,
          matcherinoUrl: item.shortlink
            ? `https://matcherino.com/t/${item.shortlink}/overview`
            : `https://matcherino.com/supercell/tournaments/${item.id}/overview`,
          identifier,
        });
      }
    } catch (err) {
      logger.warn({ err, q }, "EMEA search query failed");
    }
  }

  // Sort by most recent first
  results.sort((a, b) => {
    const da = a.startAt ? new Date(a.startAt).getTime() : 0;
    const db2 = b.startAt ? new Date(b.startAt).getTime() : 0;
    return db2 - da;
  });

  return results;
}

interface RawMember {
  userId: number;
  displayName: string;
  playerTag?: string;
}

interface RawEntrant {
  id: number;
  name: string;
  teamId?: number;
  team?: { members?: RawMember[] };
}

interface RawBrawler {
  id: number;
  name: string;
  image: string;
}

interface RawGamePlayer {
  tag: string;
  accountId?: string;
  brawler: RawBrawler;
  isLeader?: boolean;
}

interface RawGameTeam {
  bans: RawBrawler[];
  score: number;
  players: RawGamePlayer[];
  isWinner: boolean;
}

interface RawReportProperties {
  teams: RawGameTeam[];
  duration?: number;
  location?: { id: number; name: string; gameMode: string };
  replayId?: string;
}

interface RawReport {
  winner: number;
  scoreA: number;
  scoreB: number;
  gameNumber: number;
  setNumber: number;
  properties?: RawReportProperties;
}

interface RawMatch {
  id: number;
  matchNum: number;
  status: string;
  entrantA: { entrantId: number; score: number | null };
  entrantB: { entrantId: number; score: number | null };
  roundNum: number;
  totalRounds: number;
  winner: number;
  loser: number;
  bannedBrawlersEntrantA: number[] | null;
  bannedBrawlersEntrantB: number[] | null;
  pickedBrawlers: unknown;
  reports: RawReport[] | null;
  populateBrawlerNames?: Record<string, { name: string; playerTag: string }> | null;
}

interface RawBracket {
  id: number;
  bountyId: number;
  title: string;
  kind: string;
  entrants: RawEntrant[];
  matches: RawMatch[];
}

// ---- Parsed output types ----

export interface DraftEntry {
  team: string;
  value: string;
  imageUrl: string | null;
  type: string;
  playerName: string | null;
  gadget?: string | null;
  starPower?: string | null;
  hypercharge?: string | null;
  gears?: string[];
}

export interface ParsedMapDraft {
  mapName: string;
  gameMode: string | null;
  gameModeIcon: string | null;
  action: string;
  pickedBy: string | null;
  winner: string | null;
  team1Score: number | null;
  team2Score: number | null;
  duration?: number | null;
  setIndex?: number | null;
  picks: DraftEntry[];
  bans: DraftEntry[];
}

export interface ParsedMatch {
  externalMatchId: string;
  team1Name: string;
  team2Name: string;
  winnerName: string | null;
  score: string | null;
  roundName: string | null;
  maps: ParsedMapDraft[];
}

// ---- Helpers ----

function getRoundLabel(roundNum: number, totalRounds: number): string {
  const stepsFromFinal = totalRounds - roundNum;
  if (stepsFromFinal === 0) return "Final";
  if (stepsFromFinal === 1) return "Semi";
  if (stepsFromFinal === 2) return "Quarter";
  return `R${roundNum}`;
}

// Build playerTag → displayName from populateBrawlerNames
function buildTagNameMap(pbn: Record<string, { name: string; playerTag: string }> | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!pbn) return m;
  for (const entry of Object.values(pbn)) {
    if (entry.playerTag && entry.name) m.set(entry.playerTag, entry.name);
  }
  return m;
}

// Determine which RawGameTeam index (0 or 1) corresponds to entrantA
function resolveTeamIndex(
  teams: RawGameTeam[],
  entrantA: RawEntrant | undefined,
  entrantB: RawEntrant | undefined,
  reportWinner: number,
  entrantAId: number,
  entrantBId: number
): "natural" | "swapped" {
  if (teams.length < 2) return "natural";

  // Strategy 1: use playerTag from entrant members to match teams[0].players
  const tagsA = new Set<string>();
  for (const m of entrantA?.team?.members ?? []) {
    if (m.playerTag) tagsA.add(m.playerTag);
  }
  if (tagsA.size > 0) {
    const firstTag = teams[0].players?.[0]?.tag;
    if (firstTag) {
      return tagsA.has(firstTag) ? "natural" : "swapped";
    }
  }

  // Strategy 2: use isWinner + reportWinner entrantId
  if (teams[0].isWinner && reportWinner === entrantAId) return "natural";
  if (teams[1].isWinner && reportWinner === entrantAId) return "swapped";
  if (teams[0].isWinner && reportWinner === entrantBId) return "swapped";
  if (teams[1].isWinner && reportWinner === entrantBId) return "natural";

  return "natural";
}

export async function fetchTournamentByIdentifier(parsed: ParsedUrl): Promise<{
  tournament: RawBounty;
  matches: ParsedMatch[];
}> {
  let apiUrl: string;
  if (parsed.numericId) {
    apiUrl = `${BASE}/bounties/findById?id=${parsed.numericId}`;
  } else {
    apiUrl = `${BASE}/bounties/findById?id=0&shortlink=${encodeURIComponent(parsed.slug!)}`;
  }

  const bountyData = (await fetchJson(apiUrl)) as RawBounty | null;

  if (!bountyData?.id) {
    throw new Error(`Tournament not found for identifier: ${parsed.identifier}`);
  }
  logger.info({ tournamentId: bountyData.id }, "Fetched tournament");

  const bracketsData = (await fetchJson(
    `${BASE}/brackets?bountyId=${bountyData.id}`
  )) as RawBracket[] | null;

  const brackets = Array.isArray(bracketsData) ? bracketsData : [];
  logger.info({ count: brackets.length }, "Got brackets");

  const allMatches: ParsedMatch[] = [];

  for (const bracket of brackets) {
    const entrantById = new Map<number, RawEntrant>();
    const entrantMap = new Map<number, string>();
    for (const e of bracket.entrants ?? []) {
      entrantMap.set(e.id, e.name);
      entrantById.set(e.id, e);
    }

    for (const m of bracket.matches ?? []) {
      if (!m.id || m.entrantA?.entrantId === 0) continue;
      if (!m.entrantB?.entrantId || m.entrantB.entrantId === 0) continue;
      if (m.status !== "done" && m.status !== "completed") continue;

      const team1 = entrantMap.get(m.entrantA.entrantId);
      const team2 = entrantMap.get(m.entrantB.entrantId);
      if (!team1 || !team2) continue;

      const entrantA = entrantById.get(m.entrantA.entrantId);
      const entrantB = entrantById.get(m.entrantB.entrantId);

      const winnerName = m.winner ? (entrantMap.get(m.winner) ?? null) : null;
      const scoreA = m.entrantA.score;
      const scoreB = m.entrantB.score;
      const score = scoreA != null && scoreB != null ? `${scoreA}-${scoreB}` : null;
      const roundName = getRoundLabel(m.roundNum, m.totalRounds);

      // Build player tag → display name
      const tagToName = buildTagNameMap(m.populateBrawlerNames);

      const maps = parseGameSets(m, team1, team2, winnerName, entrantMap, entrantA, entrantB, tagToName);

      allMatches.push({
        externalMatchId: String(m.id),
        team1Name: team1,
        team2Name: team2,
        winnerName,
        score,
        roundName,
        maps,
      });
    }
  }

  logger.info({ matchCount: allMatches.length }, "Parsed matches");
  return { tournament: bountyData, matches: allMatches };
}

function parseGameSets(
  m: RawMatch,
  team1: string,
  team2: string,
  winnerName: string | null,
  entrantMap: Map<number, string>,
  entrantA: RawEntrant | undefined,
  entrantB: RawEntrant | undefined,
  tagToName: Map<string, string>
): ParsedMapDraft[] {
  const reports = m.reports ?? [];

  // Use reports[].properties as primary source (has map names + team-split data)
  const reportsWithProps = reports.filter((r) => r.properties?.teams?.length);

  if (reportsWithProps.length > 0) {
    return reportsWithProps.map((report) => {
      const props = report.properties!;
      const teams = props.teams;

      // Determine which team index is team1 (entrantA)
      const order = resolveTeamIndex(
        teams,
        entrantA,
        entrantB,
        report.winner,
        m.entrantA.entrantId,
        m.entrantB.entrantId
      );
      const t1 = order === "natural" ? teams[0] : teams[1];
      const t2 = order === "natural" ? teams[1] : teams[0];

      const mapName = props.location?.name ?? "—";
      const gameMode = props.location?.gameMode ?? null;

      const gameWinner = report.winner ? (entrantMap.get(report.winner) ?? null) : null;

      const makePick = (p: RawGamePlayer, teamName: string) => ({
        team: teamName,
        value: p.brawler?.name ?? "?",
        imageUrl: p.brawler?.image || null,
        type: "pick" as const,
        playerName: tagToName.get(p.tag) ?? null,
      });

      const makeBan = (b: RawBrawler, teamName: string) => ({
        team: teamName,
        value: b.name ?? "?",
        imageUrl: b.image || null,
        type: "ban" as const,
        playerName: null,
      });

      const picks = [
        ...(t1?.players ?? []).map((p) => makePick(p, team1)),
        ...(t2?.players ?? []).map((p) => makePick(p, team2)),
      ];

      const bans = [
        ...(t1?.bans ?? []).map((b) => makeBan(b, team1)),
        ...(t2?.bans ?? []).map((b) => makeBan(b, team2)),
      ];

      return {
        mapName,
        gameMode,
        gameModeIcon: null,
        action: "played",
        pickedBy: null,
        winner: gameWinner,
        team1Score: t1 !== undefined ? t1.score : (report.scoreA ?? null),
        team2Score: t2 !== undefined ? t2.score : (report.scoreB ?? null),
        picks,
        bans,
      };
    });
  }

  // Fallback: no report properties — show match summary only
  return [
    {
      mapName: "—",
      gameMode: null,
      gameModeIcon: null,
      action: "played",
      pickedBy: null,
      winner: winnerName,
      team1Score: m.entrantA?.score ?? null,
      team2Score: m.entrantB?.score ?? null,
      picks: [],
      bans: [],
    },
  ];
}

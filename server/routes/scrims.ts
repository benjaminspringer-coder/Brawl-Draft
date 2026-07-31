import { Router } from "express";
import { db } from "@workspace/db";
import { scrimsTable, nonEmeaScrimsTable } from "@workspace/db";
import { eq, ne, desc, gte, and, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const KNOWN_TEAM_REGIONS: Record<string, string> = {
  // EMEA
  "2012": "EMEA", "HMB": "EMEA", "TTM": "EMEA", "NOVO": "EMEA", "MZP": "EMEA",
  "FUT2": "EMEA", "SK": "EMEA", "MAD": "EMEA", "KBP": "EMEA", "SXS": "EMEA",
  "TLF": "EMEA", "FUT": "EMEA", "WW": "EMEA", "NAVI": "EMEA", "BIG": "EMEA",
  "ZEN": "EMEA", "TH": "EMEA", "AQL": "EMEA", "BC": "EMEA", "BIZZA": "EMEA",
  "CGO": "EMEA", "IDI": "EMEA", "TGRB": "EMEA", "FNRS": "EMEA", "GLB": "EMEA",
  "K13": "EMEA", "KUMA": "EMEA", "PWD": "EMEA", "REV": "EMEA", "SLC": "EMEA",
  "TLB": "EMEA", "TLB2": "EMEA", "TLF2": "EMEA", "FUT_ACADEMY": "EMEA", "SK_GAMING": "EMEA",

  // NA
  "TE": "NA", "TRB": "NA", "BOB": "NA", "VTC": "NA", "HML": "NA",
  "VIC": "NA", "NAME": "NA", "LGCY": "NA", "MOMO": "NA", "KDS": "NA",
  "NOVA": "NA", "TRIBE": "NA", "STK": "NA", "LG": "NA", "SSG": "NA",
  "B3": "NA", "MST": "NA", "UN": "NA", "TLA": "NA", "MBU": "NA",
  "RNT": "NA", "KCP": "NA", "AM": "NA", "CMG": "NA", "W2S": "NA", "MTM": "NA",

  // SA
  "RCD": "SA", "LOUD": "SA", "OS": "SA", "SKCSA": "SA", "OCXD": "SA",
  "ZRT": "SA", "AL": "SA", "BH": "SA", "CB": "SA", "ODS": "SA",
  "PCNG": "SA", "TTPD": "SA", "QLS": "SA", "SPG": "SA", "ALPHA": "SA",
  "PAIN": "SA", "VK": "SA", "INTA": "SA", "RED": "SA", "ISG": "SA", "S2": "SA",

  // EA / APAC
  "ZETA": "EA", "CR": "EA", "RVL": "EA", "SKC": "EA", "RC": "EA",
  "FL": "EA", "IGM": "EA", "INS": "EA", "AXIS": "EA", "FZ": "EA",
  "FZ2": "EA", "REJECT": "EA", "NAVI_EA": "EA", "DF": "EA", "NFX": "EA", "RNT_EA": "EA",
  "AXR": "EA", "TL": "EA", "RNTX": "EA"
};

const EMEA_CODES = new Set(Object.keys(KNOWN_TEAM_REGIONS).filter(k => KNOWN_TEAM_REGIONS[k] === "EMEA"));
const NA_CODES = new Set(Object.keys(KNOWN_TEAM_REGIONS).filter(k => KNOWN_TEAM_REGIONS[k] === "NA"));
const SA_CODES = new Set(Object.keys(KNOWN_TEAM_REGIONS).filter(k => KNOWN_TEAM_REGIONS[k] === "SA"));
const EA_CODES = new Set(Object.keys(KNOWN_TEAM_REGIONS).filter(k => KNOWN_TEAM_REGIONS[k] === "EA"));

const EMEA_COUNTRIES = new Set([
  "DE","FR","ES","IT","TR","UK","GB","PL","SE","FI","RU","SA","AE","QA","EG",
  "UA","NL","BE","CH","AT","NO","DK","IE","PT","GR","HU","CZ","RO","BG","HR",
  "RS","IL","MA","DZ","TN","ZA","KZ"
]);

const NA_COUNTRIES = new Set(["US","CA","MX","PR"]);
const SA_COUNTRIES = new Set(["BR","AR","CL","PE","CO","UY","PY","EC"]);
const EA_COUNTRIES = new Set(["JP","KR","TW","HK","MO"]);
const CN_COUNTRIES = new Set(["CN"]);
const SEA_COUNTRIES = new Set(["PH","SG","TH","MY","ID","VN","AU","NZ"]);

const CORESTATS_URL = "https://corestats.pro/api/scrims";
const CORESTATS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://corestats.pro/scrims",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://corestats.pro",
  "Cookie": "",
};

let lastUpdated: string | null = null;
const syncRunningByDate = new Set<string>();

const teamRegionCache = new Map<string, string>(Object.entries(KNOWN_TEAM_REGIONS));
let teamCacheLastFetched = 0;

async function refreshTeamRegionCache() {
  if (Date.now() - teamCacheLastFetched < 30 * 60 * 1000 && teamRegionCache.size > Object.keys(KNOWN_TEAM_REGIONS).length) return;
  try {
    const res = await fetch("https://corestats.pro/api/teams", { headers: CORESTATS_HEADERS });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.teams || [];
      list.forEach((t: any) => {
        if (t.code && t.region) teamRegionCache.set(t.code.toUpperCase(), t.region);
        if (t.name && t.region) teamRegionCache.set(t.name.toUpperCase(), t.region);
      });
      teamCacheLastFetched = Date.now();
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch corestats teams for region mapping");
  }
}

export function detectScrimRegion(s: any): string {
  const t1wt = s.teams?.[0]?.worlds_teams?.[0];
  const t2wt = s.teams?.[1]?.worlds_teams?.[0];

  const c1 = t1wt?.team_code?.toUpperCase();
  const c2 = t2wt?.team_code?.toUpperCase();

  if (c1 && teamRegionCache.has(c1)) return teamRegionCache.get(c1)!;
  if (c2 && teamRegionCache.has(c2)) return teamRegionCache.get(c2)!;

  const allPlayers = [
    ...(t1wt?.players || s.teams?.[0]?.other_players || []),
    ...(t2wt?.players || s.teams?.[1]?.other_players || [])
  ];

  for (const p of allPlayers) {
    if (p.name && p.name.includes("|")) {
      const code = p.name.split("|")[0].trim().toUpperCase();
      if (teamRegionCache.has(code)) return teamRegionCache.get(code)!;
    }
  }

  for (const p of allPlayers) {
    if (p.country) {
      const country = p.country.toUpperCase();
      if (EMEA_COUNTRIES.has(country)) return "EMEA";
      if (NA_COUNTRIES.has(country)) return "NA";
      if (SA_COUNTRIES.has(country)) return "SA";
      if (EA_COUNTRIES.has(country) || CN_COUNTRIES.has(country) || SEA_COUNTRIES.has(country)) return "EA";
    }
  }

  return "EMEA";
}

export function getScrimRegion(s: any): string {
  const c1 = (s.team1Code || s.team1_code)?.toUpperCase();
  const c2 = (s.team2Code || s.team2_code)?.toUpperCase();

  if (c1 && teamRegionCache.has(c1)) return teamRegionCache.get(c1)!;
  if (c2 && teamRegionCache.has(c2)) return teamRegionCache.get(c2)!;

  const players = [
    ...(s.team1Players || s.team1_players || []),
    ...(s.team2Players || s.team2_players || []),
  ];

  for (const p of players) {
    if (p.name && p.name.includes("|")) {
      const code = p.name.split("|")[0].trim().toUpperCase();
      if (teamRegionCache.has(code)) return teamRegionCache.get(code)!;
    }
  }

  for (const p of players) {
    if (p.country) {
      const country = p.country.toUpperCase();
      if (EMEA_COUNTRIES.has(country)) return "EMEA";
      if (NA_COUNTRIES.has(country)) return "NA";
      if (SA_COUNTRIES.has(country)) return "SA";
      if (EA_COUNTRIES.has(country) || CN_COUNTRIES.has(country) || SEA_COUNTRIES.has(country)) return "EA";
    }
  }

  if (s.region) return s.region;
  return "EMEA";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function syncScrims(dateStr?: string): Promise<{ inserted: number; skipped: number }> {
  const key = dateStr ?? "__latest__";
  if (syncRunningByDate.has(key)) return { inserted: 0, skipped: 0 };
  syncRunningByDate.add(key);
  let inserted = 0;
  let skipped = 0;

  try {
    await refreshTeamRegionCache();
    const url = dateStr ? `${CORESTATS_URL}?date=${dateStr}&limit=1000` : `${CORESTATS_URL}?limit=500`;
    const res = await fetch(url, { headers: CORESTATS_HEADERS });
    if (!res.ok) throw new Error(`corestats HTTP ${res.status}`);
    const json = (await res.json()) as any;

    if (json.last_updated) lastUpdated = json.last_updated;

    const scrims: any[] = json.scrims ?? [];

    for (const s of scrims) {
      // Filter out Matcherino tournaments (scrims only)
      if (s.is_tournament || s.type === "matcherino" || s.is_matcherino) {
        continue;
      }

      const t1wt = s.teams?.[0]?.worlds_teams?.[0];
      const t2wt = s.teams?.[1]?.worlds_teams?.[0];

      const mapRawPlayers = (players: any[]) =>
        (players ?? []).map((p: any) => ({
          name: p.name ?? "",
          brawler: p.brawler ?? "",
          brawlerId: p.brawler_id ?? 0,
          tag: p.tag ?? "",
          country: p.country ?? "",
          isSubstitute: p.is_substitute ?? false,
        }));

      const t1RawPlayers: any[] =
        t1wt?.players && t1wt.players.length > 0
          ? t1wt.players
          : s.teams?.[0]?.other_players ?? [];

      const t2RawPlayers: any[] =
        t2wt?.players && t2wt.players.length > 0
          ? t2wt.players
          : s.teams?.[1]?.other_players ?? [];

      const inferTeamInfo = (wt: any, players: any[]) => {
        if (wt?.team_code && wt.team_code.trim()) {
          return {
            code: wt.team_code.trim(),
            name: wt.team_name?.trim() || wt.team_code.trim(),
          };
        }

        const prefixCounts: Record<string, number> = {};
        const playerCleanNames: string[] = [];

        for (const p of players) {
          const rawName = p.name || "";
          if (rawName.includes("|")) {
            const parts = rawName.split("|");
            const prefix = parts[0].trim();
            const cleanName = parts.slice(1).join("|").trim() || rawName;
            if (prefix && prefix.length >= 2) {
              prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
            }
            if (cleanName) playerCleanNames.push(cleanName);
          } else {
            if (rawName.trim()) playerCleanNames.push(rawName.trim());
          }
        }

        let foundPrefix: string | null = null;
        for (const [prefix, count] of Object.entries(prefixCounts)) {
          if (count >= 2) {
            foundPrefix = prefix;
            break;
          }
        }

        if (foundPrefix) {
          return {
            code: foundPrefix,
            name: foundPrefix,
          };
        }

        const namesStr = playerCleanNames.join(", ");
        return {
          code: null,
          name: namesStr || null,
        };
      };

      const t1Info = inferTeamInfo(t1wt, t1RawPlayers);
      const t2Info = inferTeamInfo(t2wt, t2RawPlayers);

      const detectedRegion = detectScrimRegion(s);

      const record = {
        scrimId: s.scrim_id,
        time: new Date(s.time.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")),
        mode: s.mode ?? "",
        map: s.map ?? "",
        duration: s.duration ?? null,
        scoreline: s.scoreline ?? null,
        winnerTeamCode: s.winner_team_code ?? null,
        isTournament: false,
        team1Code: t1Info.code,
        team1Name: t1Info.name,
        team2Code: t2Info.code,
        team2Name: t2Info.name,
        team1Players: mapRawPlayers(t1RawPlayers),
        team2Players: mapRawPlayers(t2RawPlayers),
        mvpPlayer: s.mvp?.player_name ?? null,
        mvpTeam: s.mvp?.team ?? null,
        region: detectedRegion,
      };

      try {
        const targetTable = detectedRegion === "EMEA" ? scrimsTable : nonEmeaScrimsTable;
        const result = await db
          .insert(targetTable)
          .values(record)
          .onConflictDoUpdate({
            target: targetTable.scrimId,
            set: {
              team1Players: record.team1Players as any,
              team2Players: record.team2Players as any,
              team1Code: record.team1Code,
              team1Name: record.team1Name,
              team2Code: record.team2Code,
              team2Name: record.team2Name,
              region: record.region,
            },
          })
          .returning({ id: targetTable.scrimId, updated: targetTable.id });
        if (result.length > 0) inserted++;
        else skipped++;
      } catch {
        skipped++;
      }
    }
  } catch (err) {
    logger.error({ err }, "syncScrims error");
  } finally {
    syncRunningByDate.delete(key);
  }

  return { inserted, skipped };
}

const lastSyncedAtByDate = new Map<string, number>();

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

export function getTeamScore(code?: string | null, name?: string | null, players?: any[]): number {
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

async function ensureDateSynced(dateStr?: string) {
  if (!dateStr) dateStr = formatDate(new Date());
  const last = lastSyncedAtByDate.get(dateStr) || 0;
  if (Date.now() - last > 2 * 60 * 1000 && !syncRunningByDate.has(dateStr)) {
    await syncScrims(dateStr);
    lastSyncedAtByDate.set(dateStr, Date.now());
  }
}

async function reclassifyAllDbScrims() {
  try {
    await refreshTeamRegionCache();
    // 1. Move non-EMEA rows from scrimsTable to nonEmeaScrimsTable if needed, then purge from scrimsTable
    const allEmeaDb = await db.select().from(scrimsTable);
    for (const s of allEmeaDb) {
      const reg = getScrimRegion(s);
      if (reg !== "EMEA") {
        try {
          await db.insert(nonEmeaScrimsTable).values({ ...s, region: reg }).onConflictDoNothing();
          await db.delete(scrimsTable).where(eq(scrimsTable.id, s.id));
        } catch {
          // ignore error
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error reclassifying DB scrims");
  }
}

export function startScrimsPolling() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setDate(today.getDate() - 2);

  Promise.all([
    syncScrims(formatDate(today)),
    syncScrims(formatDate(yesterday)),
    syncScrims(formatDate(dayBefore)),
  ]).then(async ([r1, r2, r3]) => {
    logger.info({ today: r1, yesterday: r2, dayBefore: r3 }, "Initial scrims sync complete");
    await reclassifyAllDbScrims();
  }).catch((err) => logger.error({ err }, "Initial scrims sync failed"));

  setInterval(async () => {
    try {
      const result = await syncScrims(formatDate(new Date()));
      if (result.inserted > 0) logger.info({ result }, "Scrims polling: new scrims");
    } catch (err) {
      logger.error({ err }, "Scrims polling error");
    }
  }, 5 * 60 * 1000);
}

router.post("/scrims/sync", async (req, res) => {
  const { date } = req.body ?? {};
  const result = await syncScrims(date);
  res.json({ ok: true, ...result });
});

router.get("/scrims/meta", async (req, res) => {
  try {
    const { region, date } = req.query as Record<string, string>;
    const targetDate = date || formatDate(new Date());

    await ensureDateSynced(targetDate);
    await refreshTeamRegionCache();
    const emeaScrims = await db.select().from(scrimsTable);
    const otherScrims = await db.select().from(nonEmeaScrimsTable);
    const allScrims = [...emeaScrims, ...otherScrims];

    // Filter scrims by selected date
    const dateScrims = allScrims.filter((s: any) => {
      if (!s.time) return false;
      const sTimeIso = new Date(s.time).toISOString();
      return sTimeIso.slice(0, 10) === targetDate;
    });

    const regionCounts: Record<string, number> = {
      EMEA: 0,
      NA: 0,
      SA: 0,
      EA: 0,
    };

    dateScrims.forEach((s: any) => {
      const reg = getScrimRegion(s);
      regionCounts[reg] = (regionCounts[reg] || 0) + 1;
    });

    let relevantScrims = dateScrims;
    if (region) {
      relevantScrims = dateScrims.filter((s: any) => getScrimRegion(s) === region);
    }

    const modesSet = new Set<string>();
    const mapsSet = new Set<string>();
    const teamsMap = new Map<string, string | null>();

    relevantScrims.forEach((s: any) => {
      if (s.mode) modesSet.add(s.mode);
      if (s.map) mapsSet.add(s.map);
      if (s.team1Code) teamsMap.set(s.team1Code, s.team1Name || s.team1Code);
      if (s.team2Code) teamsMap.set(s.team2Code, s.team2Name || s.team2Code);
    });

    const teams = Array.from(teamsMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => {
        const sA = getTeamScore(a.code, a.name);
        const sB = getTeamScore(b.code, b.name);
        if (sB !== sA) return sB - sA;
        return (a.code ?? "").localeCompare(b.code ?? "");
      });

    res.json({
      modes: Array.from(modesSet).sort(),
      maps: Array.from(mapsSet).sort(),
      teams,
      regionCounts,
      emeaCodes: Array.from(EMEA_CODES),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/scrims/meta error");
    res.status(500).json({ error: "Failed to fetch scrims meta" });
  }
});

router.get("/scrims", async (req, res) => {
  try {
    const { date, team, mode, map, region, limit = "300" } = req.query as Record<string, string>;
    const maxLimit = Math.min(parseInt(limit) || 300, 1000);

    if (date) {
      await ensureDateSynced(date);
    } else {
      await ensureDateSynced(formatDate(new Date()));
    }

    await refreshTeamRegionCache();
    
    // Primary EMEA DB vs separate non-EMEA DB routing
    const isNonEmea = region && ["NA", "SA", "EA"].includes(region);
    const targetTable = isNonEmea ? nonEmeaScrimsTable : scrimsTable;
    const allScrims = await db.select().from(targetTable);

    let filtered = (allScrims || []).filter((s: any) => {
      const sRegion = getScrimRegion(s);

      if (region) {
        if (sRegion !== region) return false;
      } else {
        if (sRegion !== "EMEA") return false;
      }

      const t1 = s.team1Code || s.team1_code;
      const t2 = s.team2Code || s.team2_code;
      if (team && t1 !== team && t2 !== team) return false;

      const sMode = s.mode;
      if (mode && sMode !== mode) return false;

      const sMap = s.map;
      if (map && sMap !== map) return false;

      if (date && s.time) {
        const sTimeIso = new Date(s.time).toISOString();
        const sDateStr = sTimeIso.slice(0, 10);
        if (sDateStr !== date) return false;
      }

      return true;
    });

    filtered.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const result = filtered.slice(0, maxLimit).map((r: any) => ({
      id: r.id,
      scrimId: r.scrimId ?? r.scrim_id,
      time: r.time,
      mode: r.mode,
      map: r.map,
      duration: r.duration,
      scoreline: r.scoreline,
      winnerTeamCode: r.winnerTeamCode ?? r.winner_team_code,
      isTournament: Boolean(r.isTournament ?? r.is_tournament),
      team1Code: r.team1Code ?? r.team1_code ?? null,
      team1Name: r.team1Name ?? r.team1_name ?? null,
      team2Code: r.team2Code ?? r.team2_code ?? null,
      team2Name: r.team2Name ?? r.team2_name ?? null,
      team1Players: r.team1Players ?? r.team1_players ?? [],
      team2Players: r.team2Players ?? r.team2_players ?? [],
      mvpPlayer: r.mvpPlayer ?? r.mvp_player ?? null,
      mvpTeam: r.mvpTeam ?? r.mvp_team ?? null,
      region: getScrimRegion(r),
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /api/scrims error");
    res.status(500).json({ error: "Failed to fetch scrims" });
  }
});

export default router;

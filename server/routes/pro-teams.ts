import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

// ─── Types ────────────────────────────────────────────────

type CorestatsTeam = {
  code: string;
  is_tryout: boolean;
  logo: string;
  losses: number;
  name: string;
  points: number;
  rank: number;
  region: string;
  roster: { country: string; name: string; tag: string }[];
  win_rate: number | null;
  wins: number;
  qualified_events: string[];
};

export type ProTeam = {
  rank: number;
  name: string;
  points: number;
  region: string;
  logo: string;
  roster: string[];
  wins: number;
  losses: number;
  winRate: number | null;
  qualifiedEvents: string[];
  isTryout: boolean;
  code: string;
};

type LeaderboardEntry = { rank: number; name: string; points: number; region: string };

// ─── Official Ground Truth Standings (BSC 2026) ─────────────

const BSC_2026_EMEA: LeaderboardEntry[] = [
  { rank:  1, name: "FUT Esports",         points: 622, region: "EMEA" },
  { rank:  2, name: "HMBLE",               points: 480, region: "EMEA" },
  { rank:  3, name: "Totem Esports",       points: 347, region: "EMEA" },
  { rank:  4, name: "NOVO Esports",        points: 340, region: "EMEA" },
  { rank:  5, name: "Team Heretics",       points: 286, region: "EMEA" },
  { rank:  6, name: "Natus Vincere",       points: 282, region: "EMEA" },
  { rank:  7, name: "Kumalazawesta",       points: 271, region: "EMEA" },
  { rank:  8, name: "BIG",                 points: 270, region: "EMEA" },
  { rank:  9, name: "Metizport",           points: 243, region: "EMEA" },
  { rank: 10, name: "FUT Esports Academy", points: 240, region: "EMEA" },
  { rank: 11, name: "SK Gaming",           points: 233, region: "EMEA" },
  { rank: 12, name: "Madrid",              points: 231, region: "EMEA" },
  { rank: 13, name: "Kebap",               points: 216, region: "EMEA" },
  { rank: 14, name: "Fenris Gaming",       points: 203, region: "EMEA" },
  { rank: 15, name: "Reverso Hive",       points: 193, region: "EMEA" },
  { rank: 16, name: "WW",                  points: 190, region: "EMEA" },
];

const BSC_2026_NA: LeaderboardEntry[] = [
  { rank:  1, name: "Team Elektros",  points: 458, region: "NA" },
  { rank:  2, name: "Tribe Gaming",   points: 446, region: "NA" },
  { rank:  3, name: "KDS Esports",    points: 336, region: "NA" },
  { rank:  4, name: "Vatic Esports",  points: 324, region: "NA" },
  { rank:  5, name: "F/A Homeless",   points: 248, region: "NA" },
  { rank:  6, name: "Vic Day",        points: 241, region: "NA" },
  { rank:  7, name: "Nova Esports",   points: 232, region: "NA" },
  { rank:  8, name: "Legacy Esports", points: 220, region: "NA" },
  { rank:  9, name: "Utopia",         points: 194, region: "NA" },
  { rank: 10, name: "David's Aura",   points: 192, region: "NA" },
];

const BSC_2026_SA: LeaderboardEntry[] = [
  { rank:  1, name: "Bounty Hunters",  points: 465, region: "SA" },
  { rank:  2, name: "RED Canids",      points: 440, region: "SA" },
  { rank:  3, name: "LOUD",            points: 331, region: "SA" },
  { rank:  4, name: "Olimpo Squad",    points: 300, region: "SA" },
  { rank:  5, name: "SKCalalas",       points: 279, region: "SA" },
  { rank:  6, name: "OCX Division",    points: 252, region: "SA" },
  { rank:  7, name: "Ninguem Segura",  points: 222, region: "SA" },
  { rank:  8, name: "QuieroQueQue",    points: 175, region: "SA" },
  { rank:  9, name: "Six Seven",       points: 140, region: "SA" },
  { rank: 10, name: "Dropeados 2026",  points: 130, region: "SA" },
];

const BSC_2026_EA: LeaderboardEntry[] = [
  { rank:  1, name: "ZETA DIVISION",  points: 508, region: "EA" },
  { rank:  2, name: "Crazy Raccoon",  points: 421, region: "EA" },
  { rank:  3, name: "Rival Esports",  points: 305, region: "EA" },
  { rank:  4, name: "SKCalalas EA",   points: 289, region: "EA" },
  { rank:  5, name: "REJECT",         points: 219, region: "EA" },
  { rank:  6, name: "FENNEL",         points: 218, region: "EA" },
  { rank:  7, name: "IGNUM",          points: 190, region: "EA" },
  { rank:  8, name: "INSOMNIA",       points: 188, region: "EA" },
  { rank:  9, name: "AXIS e-Sports",  points: 163, region: "EA" },
  { rank: 10, name: "Frenzy Esports", points: 146, region: "EA" },
];

// ─── Helpers ──────────────────────────────────────────────

function formatLogo(logo: string): string {
  if (!logo) return "";
  if (logo.startsWith("http")) return logo;
  return `https://corestats.pro${logo}`;
}

function stripPrefix(name: string, code: string): string {
  if (!name) return "";
  return name.replace(new RegExp(`^${code}\\s*[|]\\s*`, "i"), "").trim();
}

function matchCorestats(lpName: string, csTeams: CorestatsTeam[]): CorestatsTeam | undefined {
  const rawN = lpName.toLowerCase().trim();
  const cleanN = rawN.replace(/esports|gaming/g, "").trim();

  return (
    csTeams.find((t) => t.name.toLowerCase() === rawN) ??
    csTeams.find((t) => t.name.toLowerCase().includes(rawN) || rawN.includes(t.name.toLowerCase())) ??
    csTeams.find((t) => cleanN.length >= 3 && (t.name.toLowerCase().includes(cleanN) || cleanN.includes(t.name.toLowerCase()))) ??
    csTeams.find((t) => {
      const fw = rawN.split(/\s+/)[0];
      return fw.length >= 3 && (t.name.toLowerCase().includes(fw) || t.code.toLowerCase() === fw);
    })
  );
}

// ─── Corestats Fetcher ────────────────────────────────────

let corestatsCache: CorestatsTeam[] | null = null;
let corestatsCacheTime = 0;
const CORESTATS_TTL = 30 * 60 * 1000;

async function getCorestatsTeams(): Promise<CorestatsTeam[]> {
  if (corestatsCache && Date.now() - corestatsCacheTime < CORESTATS_TTL) {
    return corestatsCache;
  }
  try {
    const res = await fetch("https://corestats.pro/api/teams", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://corestats.pro/",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { teams: CorestatsTeam[] } | CorestatsTeam[];
    const teams = Array.isArray(data) ? data : data.teams ?? [];
    if (teams.length > 0) {
      corestatsCache = teams;
      corestatsCacheTime = Date.now();
    }
    return corestatsCache ?? teams;
  } catch (err) {
    logger.error({ err }, "Failed to fetch Corestats teams");
    return corestatsCache ?? [];
  }
}

// ─── Leaderboard Builder ─────────────────────────────────

async function buildLeaderboard(): Promise<ProTeam[]> {
  const csTeams = await getCorestatsTeams();

  const regionConfigs: [string, LeaderboardEntry[]][] = [
    ["EMEA", BSC_2026_EMEA],
    ["NA",   BSC_2026_NA],
    ["SA",   BSC_2026_SA],
    ["EA",   BSC_2026_EA],
  ];

  const result: ProTeam[] = [];

  for (const [region, entries] of regionConfigs) {
    const regionCs = csTeams.filter((t) => t.region === region);

    const regionProTeams: ProTeam[] = entries.map((entry, idx) => {
      const cs = matchCorestats(entry.name, regionCs) ?? matchCorestats(entry.name, csTeams);

      return {
        rank:            idx + 1,
        name:            entry.name,
        points:          entry.points,
        region,
        logo:            cs ? formatLogo(cs.logo) : "",
        roster:          cs ? cs.roster.map((p) => stripPrefix(p.name, cs.code)).filter(Boolean) : [],
        wins:            cs?.wins ?? 0,
        losses:          cs?.losses ?? 0,
        winRate:         cs?.win_rate ?? null,
        qualifiedEvents: cs?.qualified_events ?? [],
        isTryout:        cs?.is_tryout ?? false,
        code:            cs?.code ?? "",
      };
    });

    result.push(...regionProTeams);
  }

  return result;
}

// ─── Routes ───────────────────────────────────────────────

router.get("/pro-teams/leaderboard", async (_req, res) => {
  try {
    const teams = await buildLeaderboard();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json(teams);
  } catch (err) {
    logger.error({ err }, "GET /api/pro-teams/leaderboard error");
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/pro-teams/teams-meta", async (_req, res) => {
  try {
    const teams = await getCorestatsTeams();
    res.json(teams);
  } catch (err) {
    logger.error({ err }, "GET /api/pro-teams/teams-meta error");
    res.status(500).json({ error: "Failed to fetch teams metadata" });
  }
});

export default router;

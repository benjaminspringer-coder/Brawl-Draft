import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const EU_REGION_IDS = new Set([14, 15, 17, 18, 25]);

const REGION_NAMES: Record<number, string> = {
  14: "EU/Ireland",
  15: "EU/Italy",
  17: "EU/Germany-2",
  18: "EU/Finland",
  25: "EU/Germany-1",
};

const CORESTATS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://corestats.pro/tournaments",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://corestats.pro",
};

export interface EuTournament {
  id: number;
  title: string;
  region: string;
  gameRegionId: number;
  bracketStatus: string;
  startAt: string | null;
  prizePool: string;
  teamsRegistered: number;
  matcherinoLink: string;
  /** URL accepted by our existing /api/tournaments POST endpoint */
  importUrl: string;
}

async function fetchAllEuTournaments(): Promise<EuTournament[]> {
  const all: any[] = [];
  const pageSize = 100;
  let page = 1;

  while (true) {
    const url = `https://corestats.pro/api/tournaments?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, { headers: CORESTATS_HEADERS as any });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (text.includes("<html")) {
        throw new Error(
          "Corestats returned HTML (Cloudflare block?) — try again later"
        );
      }
      throw new Error(`corestats HTTP ${res.status}`);
    }

    const json = (await res.json()) as any;
    const contents: any[] = json?.body?.contents ?? [];

    if (contents.length === 0) break;
    all.push(...contents);

    logger.info(
      { page, fetched: contents.length, totalSoFar: all.length },
      "corestats page fetched"
    );

    // Stop if we got fewer than a full page (last page)
    if (contents.length < pageSize) break;
    page++;
  }

  const now = new Date();

  return all
    .filter((t) => {
      const isEU = EU_REGION_IDS.has(t.gameRegionId);
      const startInPast = t.startAt && new Date(t.startAt) < now;
      const isNotUpcoming = !["preparing", "ready", "check-in"].includes(
        t.bracketStatus
      );
      return isEU && startInPast && isNotUpcoming;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      region: REGION_NAMES[t.gameRegionId] ?? `Region-${t.gameRegionId}`,
      gameRegionId: t.gameRegionId,
      bracketStatus: t.bracketStatus as string,
      startAt: t.startAt ?? null,
      prizePool: t.totalBalance ? (t.totalBalance / 100).toFixed(2) : "0.00",
      teamsRegistered: t.teamSignups ?? 0,
      matcherinoLink: `https://matcherino.com/tournaments/${t.id}`,
      importUrl: `https://matcherino.com/tournaments/${t.id}`,
    }))
    .sort(
      (a, b) =>
        new Date(b.startAt ?? 0).getTime() -
        new Date(a.startAt ?? 0).getTime()
    );
}

router.get("/corestats/eu-scan", async (req, res) => {
  try {
    logger.info("corestats EU scan started");
    const tournaments = await fetchAllEuTournaments();
    logger.info({ count: tournaments.length }, "corestats EU scan complete");
    res.json({ ok: true, count: tournaments.length, tournaments });
  } catch (err) {
    logger.error({ err }, "corestats EU scan failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;

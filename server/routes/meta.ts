import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, scrimsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

type MapDraft = {
  picks?: { playerName?: string | null; team?: string }[];
  team1Name?: string;
  team2Name?: string;
};

router.get("/meta", async (_req, res) => {
  try {
    const [scrims, matches] = await Promise.all([
      db.select().from(scrimsTable),
      db.select().from(matchesTable),
    ]);

    const playersSet = new Set<string>();
    const teamsSet = new Set<string>();

    // Collect from scrims (EMEA only)
    for (const s of scrims) {
      if ((s.region || "EMEA") !== "EMEA") continue;
      if (s.team1Name) teamsSet.add(s.team1Name);
      if (s.team2Name) teamsSet.add(s.team2Name);
      for (const p of (s.team1Players ?? []) as any[]) {
        if (p.name) playersSet.add(p.name);
      }
      for (const p of (s.team2Players ?? []) as any[]) {
        if (p.name) playersSet.add(p.name);
      }
    }

    // Collect from matcherino matches
    for (const m of matches) {
      if (m.team1Name) teamsSet.add(m.team1Name);
      if (m.team2Name) teamsSet.add(m.team2Name);
      for (const map of (m.maps ?? []) as MapDraft[]) {
        for (const pick of map.picks ?? []) {
          if (pick.playerName) playersSet.add(pick.playerName);
        }
      }
    }

    res.json({
      players: [...playersSet].sort((a, b) => a.localeCompare(b)),
      teams: [...teamsSet].sort((a, b) => a.localeCompare(b)),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/meta error");
    res.status(500).json({ error: "Failed to fetch meta" });
  }
});

export default router;

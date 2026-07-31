import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const allMatches = await db
      .select({
        tournamentId: matchesTable.tournamentId,
        tournamentName: tournamentsTable.name,
        team1Name: matchesTable.team1Name,
        team2Name: matchesTable.team2Name,
        winnerName: matchesTable.winnerName,
        maps: matchesTable.maps,
      })
      .from(matchesTable)
      .innerJoin(tournamentsTable, eq(matchesTable.tournamentId, tournamentsTable.id));

    const brawlers: Record<string, { picks: number; bans: number; wins: number; losses: number }> = {};
    const teams: Record<string, { wins: number; losses: number }> = {};
    const gameModes: Record<string, number> = {};

    for (const match of allMatches) {
      const maps = (Array.isArray(match.maps) ? match.maps : []) as {
        bans?: { value: string; team: string }[];
        picks?: { value: string; team: string }[];
        winner?: string;
        gameMode?: string;
      }[];

      const matchWinner = match.winnerName ?? "";
      const t1 = match.team1Name ?? "";
      const t2 = match.team2Name ?? "";
      if (t1) {
        if (!teams[t1]) teams[t1] = { wins: 0, losses: 0 };
        if (!teams[t2]) teams[t2] = { wins: 0, losses: 0 };
        if (matchWinner === t1) { teams[t1].wins++; teams[t2].losses++; }
        else if (matchWinner === t2) { teams[t2].wins++; teams[t1].losses++; }
      }

      for (const map of maps) {
        const mapWinner = map.winner ?? matchWinner;
        if (map.gameMode) {
          gameModes[map.gameMode] = (gameModes[map.gameMode] ?? 0) + 1;
        }
        for (const ban of map.bans ?? []) {
          const b = ban.value.toUpperCase();
          if (!brawlers[b]) brawlers[b] = { picks: 0, bans: 0, wins: 0, losses: 0 };
          brawlers[b].bans++;
        }
        for (const pick of map.picks ?? []) {
          const b = pick.value.toUpperCase();
          if (!brawlers[b]) brawlers[b] = { picks: 0, bans: 0, wins: 0, losses: 0 };
          brawlers[b].picks++;
          if (pick.team === mapWinner) brawlers[b].wins++;
          else brawlers[b].losses++;
        }
      }
    }

    const brawlerStats = Object.entries(brawlers)
      .map(([name, s]) => ({
        name,
        picks: s.picks,
        bans: s.bans,
        wins: s.wins,
        losses: s.losses,
        presence: s.picks + s.bans,
        winRate: s.picks > 0 ? Math.round((s.wins / s.picks) * 100) : 0,
        banRate: 0,
      }))
      .sort((a, b) => b.presence - a.presence);

    brawlerStats.forEach((b) => {
      b.banRate = allMatches.length > 0 ? Math.round((b.bans / allMatches.length) * 100) : 0;
    });

    const teamStats = Object.entries(teams)
      .map(([name, s]) => ({
        name,
        wins: s.wins,
        losses: s.losses,
        matches: s.wins + s.losses,
        winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
      }))
      .sort((a, b) => b.wins - a.wins);

    const gameModeStats = Object.entries(gameModes)
      .map(([mode, count]) => ({ mode, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalMatches: allMatches.length,
      totalBrawlers: brawlerStats.length,
      totalTeams: teamStats.length,
      brawlers: brawlerStats,
      teams: teamStats,
      gameModes: gameModeStats,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/stats error");
    res.status(500).json({ error: "Failed to compute stats" });
  }
});

export default router;

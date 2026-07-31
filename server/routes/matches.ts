import { Router } from "express";
import { db, matchesTable, tournamentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListAllMatchesQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /api/matches
router.get("/matches", async (req, res) => {
  try {
    const parsed = ListAllMatchesQueryParams.safeParse({
      tournamentId: req.query.tournamentId ? Number(req.query.tournamentId) : undefined,
    });

    let query = db
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

    let matches;
    if (parsed.success && parsed.data.tournamentId != null) {
      matches = await (query as any).where(eq(matchesTable.tournamentId, parsed.data.tournamentId));
    } else {
      matches = await query;
    }

    res.json(
      matches.map((m: any) => ({
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentName: m.tournamentName,
        externalMatchId: m.externalMatchId,
        team1Name: m.team1Name,
        team2Name: m.team2Name,
        winnerName: m.winnerName,
        score: m.score,
        roundName: m.roundName,
        maps: m.maps,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list matches");
    res.status(500).json({ error: "Failed to list matches" });
  }
});

// GET /api/tournaments/:id/matches
router.get("/tournaments/:id/matches", async (req, res) => {
  try {
    const tournamentId = Number(req.params.id);
    if (isNaN(tournamentId)) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }

    const matches = await db
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
      .where(eq(matchesTable.tournamentId, tournamentId))
      .orderBy(desc(matchesTable.createdAt));

    res.json(
      matches.map((m) => ({
        id: m.id,
        tournamentId: m.tournamentId,
        tournamentName: m.tournamentName,
        externalMatchId: m.externalMatchId,
        team1Name: m.team1Name,
        team2Name: m.team2Name,
        winnerName: m.winnerName,
        score: m.score,
        roundName: m.roundName,
        maps: m.maps,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list tournament matches");
    res.status(500).json({ error: "Failed to list matches" });
  }
});

export default router;

import { db, tournamentsTable, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchTournamentByIdentifier } from "./matcherino";
import { logger } from "./logger";

export type ParsedUrlLike = { identifier: string; slug?: string; numericId?: number };

export async function fetchAndStoreTournament(
  tournamentId: number,
  parsedUrl: ParsedUrlLike,
  url: string
): Promise<void> {
  const identifier = parsedUrl.identifier;
  try {
    const { tournament, matches } = await fetchTournamentByIdentifier(parsedUrl);

    if (matches.length > 0) {
      await db.insert(matchesTable).values(
        matches.map((m) => ({
          tournamentId,
          externalMatchId: m.externalMatchId,
          team1Name: m.team1Name,
          team2Name: m.team2Name,
          winnerName: m.winnerName,
          score: m.score,
          roundName: m.roundName,
          maps: m.maps as any,
        }))
      );
    }

    const eventDate = tournament.startAt ? new Date(tournament.startAt) : undefined;

    await db
      .update(tournamentsTable)
      .set({
        name: tournament.name ?? identifier,
        gameName: tournament.gameName ?? null,
        gameMode: tournament.gameMode ?? null,
        imageUrl: tournament.avatar ?? null,
        externalId: String(tournament.id),
        matchCount: matches.length,
        status: "done",
        ...(eventDate ? { eventDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tournamentsTable.id, tournamentId));

    logger.info({ tournamentId, matchCount: matches.length }, "Tournament data stored");
  } catch (err) {
    logger.error({ err, tournamentId, identifier }, "Failed to fetch tournament data");
    await db
      .update(tournamentsTable)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(tournamentsTable.id, tournamentId));
  }
}

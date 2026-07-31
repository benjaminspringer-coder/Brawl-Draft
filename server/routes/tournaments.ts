import { Router } from "express";
import { db, tournamentsTable, matchesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { AddTournamentBody, GetTournamentParams, DeleteTournamentParams, RefreshTournamentParams } from "@workspace/api-zod";
import { parseMatcherinoUrl, searchEmeaFeaturedEvents, fetchCorestatEmeaEvents, isBracketFullyComplete } from "../lib/matcherino";
import { fetchAndStoreTournament } from "../lib/tournament-importer";
import { getCachedDailyEvents } from "../lib/daily-events-poller";
import { logger } from "../lib/logger";

const router = Router();

function formatTournament(t: typeof tournamentsTable.$inferSelect) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    url: t.url,
    gameName: t.gameName,
    gameMode: t.gameMode,
    imageUrl: t.imageUrl,
    matchCount: t.matchCount,
    status: t.status,
    errorMessage: t.errorMessage ?? null,
    eventDate: t.eventDate ? t.eventDate.toISOString() : null,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET /api/tournaments
router.get("/tournaments", async (req, res) => {
  try {
    const tournaments = await db
      .select()
      .from(tournamentsTable)
      .orderBy(desc(sql`COALESCE(${tournamentsTable.eventDate}, ${tournamentsTable.createdAt})`));

    res.json(tournaments.map(formatTournament));
  } catch (err) {
    req.log.error({ err }, "Failed to list tournaments");
    res.status(500).json({ error: "Failed to list tournaments" });
  }
});

// POST /api/tournaments
router.post("/tournaments", async (req, res) => {
  const parsed = AddTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { url } = parsed.data;
  const parsedUrl = parseMatcherinoUrl(url);

  if (!parsedUrl) {
    res.status(400).json({ error: "Invalid Matcherino URL. Supported formats:\n• https://matcherino.com/t/<slug>/overview\n• https://matcherino.com/<game>/tournaments/<id>/overview" });
    return;
  }

  const identifier = parsedUrl.identifier;

  const existing = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.slug, identifier))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json(formatTournament(existing[0]));
    return;
  }

  const [created] = await db
    .insert(tournamentsTable)
    .values({
      slug: identifier,
      name: identifier,
      url,
      status: "fetching",
      matchCount: 0,
      source: "manual",
    })
    .returning();

  res.status(201).json(formatTournament(created));

  fetchAndStoreTournament(created.id, parsedUrl, url);
});

// GET /api/tournaments/:id
router.get("/tournaments/:id", async (req, res) => {
  const parsed = GetTournamentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, parsed.data.id))
      .limit(1);

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    res.json(formatTournament(tournament));
  } catch (err) {
    req.log.error({ err }, "Failed to get tournament");
    res.status(500).json({ error: "Failed to get tournament" });
  }
});

// DELETE /api/tournaments/:id
router.delete("/tournaments/:id", async (req, res) => {
  const parsed = DeleteTournamentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    await db.delete(tournamentsTable).where(eq(tournamentsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete tournament");
    res.status(500).json({ error: "Failed to delete tournament" });
  }
});

// POST /api/tournaments/:id/refresh
router.post("/tournaments/:id/refresh", async (req, res) => {
  const parsed = RefreshTournamentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, parsed.data.id))
      .limit(1);

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    await db
      .update(tournamentsTable)
      .set({ status: "fetching", updatedAt: new Date() })
      .where(eq(tournamentsTable.id, tournament.id));

    res.json(formatTournament({ ...tournament, status: "fetching", updatedAt: new Date() }));

    await db.delete(matchesTable).where(eq(matchesTable.tournamentId, tournament.id));
    const parsedUrl = parseMatcherinoUrl(tournament.url) ?? { identifier: tournament.slug, slug: tournament.slug };
    fetchAndStoreTournament(tournament.id, parsedUrl, tournament.url);
  } catch (err) {
    req.log.error({ err }, "Failed to refresh tournament");
    res.status(500).json({ error: "Failed to refresh tournament" });
  }
});

// GET /api/events/daily — served from in-memory cache (refreshed every 5 min + at UTC midnight)
router.get("/events/daily", (_req, res) => {
  res.json(getCachedDailyEvents());
});

// POST /api/events/sync-emea
router.post("/events/sync-emea", async (req, res) => {
  try {
    const emeaEvents = await searchEmeaFeaturedEvents();

    const imported: (typeof tournamentsTable.$inferSelect)[] = [];
    let skipped = 0;

    for (const event of emeaEvents) {
      const identifier = event.identifier;

      // Check already imported (by slug or externalId)
      const existing = await db
        .select()
        .from(tournamentsTable)
        .where(eq(tournamentsTable.slug, identifier))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Also check by externalId
      const existingById = await db
        .select()
        .from(tournamentsTable)
        .where(eq(tournamentsTable.externalId, String(event.id)))
        .limit(1);

      if (existingById.length > 0) {
        skipped++;
        continue;
      }

      const eventDate = event.startAt ? new Date(event.startAt) : null;
      const parsedUrl = parseMatcherinoUrl(event.matcherinoUrl);

      const [created] = await db
        .insert(tournamentsTable)
        .values({
          slug: identifier,
          name: event.title,
          url: event.matcherinoUrl,
          status: "fetching",
          matchCount: 0,
          source: "emea_auto",
          eventDate,
          externalId: String(event.id),
        })
        .returning();

      imported.push(created);

      if (parsedUrl) {
        fetchAndStoreTournament(created.id, parsedUrl, event.matcherinoUrl);
      }
    }

    res.json({
      imported: imported.length,
      skipped,
      events: imported.map(formatTournament),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to sync EMEA events");
    res.status(500).json({ error: "Failed to sync EMEA events" });
  }
});

// POST /api/events/backfill-emea?days=7
// One-off backfill: deep-scans Matcherino for EMEA Featured Brawl Stars events whose
// startAt falls within the last N days, imports only the ones whose bracket is fully
// complete (every match, including the final, has status "done").
router.post("/events/backfill-emea", async (req, res) => {
  const days = Number(req.query.days) || 7;

  try {
    const candidates = await fetchCorestatEmeaEvents(days);

    const imported: (typeof tournamentsTable.$inferSelect)[] = [];
    let skippedExisting = 0;
    let skippedIncomplete = 0;

    for (const event of candidates) {
      const externalId = String(event.id);

      const existing = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.externalId, externalId))
        .limit(1);

      if (existing.length > 0) {
        skippedExisting++;
        continue;
      }

      const complete = await isBracketFullyComplete(event.id);
      if (!complete) {
        skippedIncomplete++;
        continue;
      }

      const parsedUrl = parseMatcherinoUrl(event.matcherinoUrl);
      if (!parsedUrl) continue;

      const [created] = await db
        .insert(tournamentsTable)
        .values({
          slug: parsedUrl.identifier,
          name: event.title,
          url: event.matcherinoUrl,
          status: "fetching",
          matchCount: 0,
          source: "emea_auto",
          eventDate: event.startAt ? new Date(event.startAt) : null,
          externalId,
        })
        .returning();

      imported.push(created);
      await fetchAndStoreTournament(created.id, parsedUrl, event.matcherinoUrl);
    }

    res.json({
      days,
      candidates: candidates.length,
      imported: imported.length,
      skippedExisting,
      skippedIncomplete,
      events: imported.map(formatTournament),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to backfill EMEA events");
    res.status(500).json({ error: "Failed to backfill EMEA events" });
  }
});

export default router;

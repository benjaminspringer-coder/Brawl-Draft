/**
 * Daily Events Poller
 *
 * - Keeps an in-memory cache of today's and yesterday's EMEA Featured events.
 * - Refreshes the cache every POLL_INTERVAL_MS (5 min) so statuses stay live.
 * - Schedules an extra refresh exactly at UTC midnight so the today/yesterday
 *   window rolls over promptly without waiting for the next poll cycle.
 * - After every refresh, checks for newly finished events and auto-imports
 *   their drafts into the database.
 */

import { logger } from "./logger";
import { fetchDailyBrawlStarsEvents, parseMatcherinoUrl, DailyEvent } from "./matcherino";
import { fetchAndStoreTournament } from "./tournament-importer";
import { db, tournamentsTable, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface DailyCache {
  today: DailyEvent[];
  yesterday: DailyEvent[];
  fetchedAt: Date;
}

let cache: DailyCache = { today: [], yesterday: [], fetchedAt: new Date(0) };

/** Returns the current cached daily events (never throws). */
export function getCachedDailyEvents(): { today: DailyEvent[]; yesterday: DailyEvent[] } {
  return { today: cache.today, yesterday: cache.yesterday };
}

// ─── Auto-import ─────────────────────────────────────────────────────────────

/** IDs of events currently being imported — avoids duplicate concurrent imports. */
const importing = new Set<number>();

async function autoImportFinished(events: DailyEvent[]): Promise<void> {
  for (const event of events) {
    if (event.eventStatus !== "finished") continue;
    if (importing.has(event.id)) continue;

    const existing = await db
      .select({ id: tournamentsTable.id, status: tournamentsTable.status })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.externalId, String(event.id)))
      .limit(1);

    // Already fully imported — skip
    if (existing.length > 0 && existing[0].status === "done") continue;

    const parsedUrl = parseMatcherinoUrl(event.matcherinoUrl);
    if (!parsedUrl) continue;

    importing.add(event.id);

    try {
      if (existing.length > 0) {
        // Record exists but not done — re-trigger import
        const tid = existing[0].id;
        if (existing[0].status === "fetching") {
          importing.delete(event.id);
          continue;
        }
        await db
          .update(tournamentsTable)
          .set({ status: "fetching", updatedAt: new Date() })
          .where(eq(tournamentsTable.id, tid));
        await db.delete(matchesTable).where(eq(matchesTable.tournamentId, tid));

        logger.info({ eventId: event.id, title: event.title }, "Re-importing finished tournament");
        fetchAndStoreTournament(tid, parsedUrl, event.matcherinoUrl).finally(() =>
          importing.delete(event.id)
        );
      } else {
        // New record
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
            externalId: String(event.id),
          })
          .returning();

        logger.info({ eventId: event.id, title: event.title }, "Auto-importing finished tournament");
        fetchAndStoreTournament(created.id, parsedUrl, event.matcherinoUrl).finally(() =>
          importing.delete(event.id)
        );
      }
    } catch (err) {
      importing.delete(event.id);
      logger.error({ err, eventId: event.id }, "Failed to auto-import tournament");
    }
  }
}

// ─── Cache refresh ────────────────────────────────────────────────────────────

async function refreshCache(): Promise<void> {
  try {
    const result = await fetchDailyBrawlStarsEvents();
    cache = { ...result, fetchedAt: new Date() };
    logger.info(
      { today: result.today.length, yesterday: result.yesterday.length },
      "Daily events cache refreshed"
    );
    await autoImportFinished([...result.today, ...result.yesterday]);
  } catch (err) {
    logger.error({ err }, "Daily events cache refresh failed");
  }
}

// ─── Midnight rollover ────────────────────────────────────────────────────────

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  return nextMidnight.getTime() - now.getTime();
}

function scheduleMidnightRollover(): void {
  const ms = msUntilNextUtcMidnight();
  logger.info(
    { inMinutes: Math.round(ms / 60000) },
    "Midnight rollover scheduled"
  );
  setTimeout(() => {
    logger.info("UTC midnight: rolling over daily events");
    refreshCache(); // today/yesterday computed from new date automatically
    scheduleMidnightRollover(); // schedule next day
  }, ms);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function startDailyEventsPoller(): void {
  // Kick off immediately so cache is warm on first request
  refreshCache();

  // Re-poll every 5 minutes to keep statuses live
  setInterval(refreshCache, POLL_INTERVAL_MS);

  // Extra refresh exactly at midnight for prompt rollover
  scheduleMidnightRollover();
}

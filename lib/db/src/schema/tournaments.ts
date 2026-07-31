import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  gameName: text("game_name"),
  gameMode: text("game_mode"),
  imageUrl: text("image_url"),
  externalId: text("external_id"),
  matchCount: integer("match_count").notNull().default(0),
  status: text("status").notNull().default("fetching"), // fetching | done | error
  errorMessage: text("error_message"),
  eventDate: timestamp("event_date"),            // when the event took place (startAt from Matcherino)
  source: text("source").notNull().default("manual"), // manual | emea_auto
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTournamentSchema = (createInsertSchema(tournamentsTable) as any).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;

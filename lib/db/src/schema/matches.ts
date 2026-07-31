import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id, { onDelete: "cascade" }),
  externalMatchId: text("external_match_id").notNull(),
  team1Name: text("team1_name").notNull(),
  team2Name: text("team2_name").notNull(),
  winnerName: text("winner_name"),
  score: text("score"),
  roundName: text("round_name"),
  maps: jsonb("maps").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMatchSchema = (createInsertSchema(matchesTable) as any).omit({ id: true, createdAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;

import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export type ScrimPlayer = {
  name: string;
  brawler: string;
  brawlerId: number;
  tag: string;
  country: string;
  isSubstitute: boolean;
};

export const scrimsTable = pgTable("scrims", {
  id: serial("id").primaryKey(),
  scrimId: text("scrim_id").notNull().unique(),
  time: timestamp("time", { withTimezone: true }).notNull(),
  mode: text("mode").notNull(),
  map: text("map").notNull(),
  duration: integer("duration"),
  scoreline: text("scoreline"),
  winnerTeamCode: text("winner_team_code"),
  isTournament: boolean("is_tournament").default(false),
  team1Code: text("team1_code"),
  team1Name: text("team1_name"),
  team2Code: text("team2_code"),
  team2Name: text("team2_name"),
  team1Players: jsonb("team1_players").$type<ScrimPlayer[]>().default([]),
  team2Players: jsonb("team2_players").$type<ScrimPlayer[]>().default([]),
  mvpPlayer: text("mvp_player"),
  mvpTeam: text("mvp_team"),
  region: text("region").default("EMEA"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const nonEmeaScrimsTable = pgTable("non_emea_scrims", {
  id: serial("id").primaryKey(),
  scrimId: text("scrim_id").notNull().unique(),
  time: timestamp("time", { withTimezone: true }).notNull(),
  mode: text("mode").notNull(),
  map: text("map").notNull(),
  duration: integer("duration"),
  scoreline: text("scoreline"),
  winnerTeamCode: text("winner_team_code"),
  isTournament: boolean("is_tournament").default(false),
  team1Code: text("team1_code"),
  team1Name: text("team1_name"),
  team2Code: text("team2_code"),
  team2Name: text("team2_name"),
  team1Players: jsonb("team1_players").$type<ScrimPlayer[]>().default([]),
  team2Players: jsonb("team2_players").$type<ScrimPlayer[]>().default([]),
  mvpPlayer: text("mvp_player"),
  mvpTeam: text("mvp_team"),
  region: text("region").default("NA"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Scrim = typeof scrimsTable.$inferSelect;
export type InsertScrim = typeof scrimsTable.$inferInsert;

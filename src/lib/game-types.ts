export type GamePick = { brawler: string; player: string | null; imageUrl: string | null };
export type GameRecord = {
  id: string;
  source: "matcherino" | "scrim";
  date: string;
  mode: string;
  map: string;
  team1Name: string;
  team2Name: string;
  team1Code: string | null;
  team2Code: string | null;
  winner: "team1" | "team2" | null;
  score: string | null;
  team1Picks: GamePick[];
  team2Picks: GamePick[];
  bansTeam1: { brawler: string; imageUrl: string | null }[];
  bansTeam2: { brawler: string; imageUrl: string | null }[];
  bansUnknown: { brawler: string; imageUrl: string | null }[];
  roundName: string | null;
};

export function seriesKey(g: GameRecord): string {
  const teams = [
    g.team1Code || g.team1Name.trim().slice(0, 20),
    g.team2Code || g.team2Name.trim().slice(0, 20),
  ].sort().join("|");
  const day = (g.date ?? "").slice(0, 10);
  return `${g.source}||${teams}||${(g.roundName ?? "").trim()}||${day}`;
}

export type PanelEntry = {
  key: string;
  baseGame: GameRecord;
  seriesGames: GameRecord[] | null;
  loading: boolean;
  selectedBrawler: string | null;
  selectedMap: string;
};

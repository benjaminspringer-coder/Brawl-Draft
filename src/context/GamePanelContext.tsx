import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { GameRecord, PanelEntry } from "@/lib/game-types";
import { seriesKey } from "@/lib/game-types";
import type { ProTeamMeta } from "@/lib/brawl-utils";

type GamePanelContextValue = {
  panels: PanelEntry[];
  activePanel: string | null;
  setActivePanel: (key: string | null) => void;
  openPanel: (game: GameRecord, selectedBrawler: string | null, selectedMap: string) => void;
  closePanel: (key: string) => void;
  proTeams: ProTeamMeta[];
  openPanelKeys: Set<string>;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
};

const GamePanelContext = createContext<GamePanelContextValue>({
  panels: [], activePanel: null, setActivePanel: () => {},
  openPanel: () => {}, closePanel: () => {},
  proTeams: [], openPanelKeys: new Set(),
  drawerOpen: false, setDrawerOpen: () => {},
});

export function GamePanelProvider({ children }: { children: React.ReactNode }) {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [proTeams, setProTeams] = useState<ProTeamMeta[]>([]);

  useEffect(() => {
    fetch("/api/pro-teams/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d))
          setProTeams(d.filter((t) => t.name && t.logo).map((t) => ({ name: t.name, code: t.code ?? "", logo: t.logo })));
      })
      .catch(() => {});
  }, []);

  async function fetchSeriesGames(baseGame: GameRecord, key: string) {
    if (baseGame.source === "scrim") {
      setPanels((prev) => prev.map((p) => p.key === key ? { ...p, seriesGames: [baseGame], loading: false } : p));
      return;
    }
    const params = new URLSearchParams();
    params.set("source", baseGame.source);
    const teamCode = baseGame.team1Code || baseGame.team2Code;
    if (teamCode) params.set("team", teamCode);
    if (baseGame.date) {
      const d = new Date(baseGame.date);
      const from = new Date(d); from.setDate(d.getDate() - 1);
      const to = new Date(d); to.setDate(d.getDate() + 1);
      params.set("dateFrom", from.toISOString().slice(0, 10));
      params.set("dateTo", to.toISOString().slice(0, 10));
    }
    try {
      const r = await fetch(`/api/brawler-stats/games?${params}`);
      const data = await r.json();
      const all: GameRecord[] = Array.isArray(data?.games) ? data.games : [];
      const sKey = seriesKey(baseGame);
      const series = all.filter((g) => seriesKey(g) === sKey);
      setPanels((prev) => prev.map((p) => p.key === key
        ? { ...p, seriesGames: series.length > 0 ? series : [baseGame], loading: false }
        : p));
    } catch {
      setPanels((prev) => prev.map((p) => p.key === key ? { ...p, seriesGames: [baseGame], loading: false } : p));
    }
  }

  function openPanel(game: GameRecord, selectedBrawler: string | null, selectedMap: string) {
    const key = seriesKey(game);
    setPanels((prev) => {
      if (prev.find((p) => p.key === key)) { setActivePanel(key); setDrawerOpen(true); return prev; }
      return [...prev, { key, baseGame: game, seriesGames: null, loading: true, selectedBrawler, selectedMap }];
    });
    setActivePanel(key);
    setDrawerOpen(true);
    fetchSeriesGames(game, key);
  }

  function closePanel(key: string) {
    setPanels((prev) => {
      const remaining = prev.filter((p) => p.key !== key);
      if (activePanel === key) {
        const next = remaining[remaining.length - 1]?.key ?? null;
        setActivePanel(next);
        if (!next) setDrawerOpen(false);
      }
      return remaining;
    });
  }

  const openPanelKeys = useMemo(() => new Set(panels.map((p) => p.key)), [panels]);

  return (
    <GamePanelContext.Provider value={{
      panels, activePanel, setActivePanel,
      openPanel, closePanel,
      proTeams, openPanelKeys,
      drawerOpen, setDrawerOpen,
    }}>
      {children}
    </GamePanelContext.Provider>
  );
}

export function useGamePanel() {
  return useContext(GamePanelContext);
}

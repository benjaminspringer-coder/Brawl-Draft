import React, { createContext, useContext, useState, useEffect } from "react";

export type Lang = "en" | "de";

export const translations = {
  en: {
    hero_subtitle: "Pro-grade esports drafting analytics & AI analysis.",
    nav_pro_teams: "Pro Teams",
    nav_scrims: "Scrims",
    nav_maps: "Stats",
    track_placeholder: "Paste the Matcherino tournament overview link here…",
    track_hint: "Important: use the overview link — e.g. matcherino.com/t/timetowin37/overview",
    track_button: "Track",
    section_tournaments: "Tournaments",
    card_matches: "Matches",
    card_ready: "Ready",
    card_fetching: "Fetching",
    card_error: "Error",
    card_pending: "Pending",
    no_tournaments: "No tournaments tracked yet.",
    no_tournaments_sub: "Paste a Matcherino tournament URL above to get started.",
    ai_title: "Ask the AI",
    ai_subtitle: "Ask me about your actual tournament data — Picks, Bans, Win-Rates, Teams.",
    ai_placeholder: "Ask me about your tournament data…",
    ai_hint_enter: "Enter to send",
    ai_hint_shift: "Shift+Enter for newline",
    ai_hint_access: "Access to all match data",
    discord_hint: "DM me for questions,\nsuggestions or bug reports",
  },
  de: {
    hero_subtitle: "Profi-Esports Draft-Analyse & KI-Auswertung.",
    nav_pro_teams: "Pro Teams",
    nav_scrims: "Scrims",
    nav_maps: "Stats",
    track_placeholder: "Matcherino Turnier-Übersichtslink hier einfügen…",
    track_hint: "Wichtig: Nutze den Übersichtslink — z.B. matcherino.com/t/timetowin37/overview",
    track_button: "Tracken",
    section_tournaments: "Turniere",
    card_matches: "Spiele",
    card_ready: "Bereit",
    card_fetching: "Lädt…",
    card_error: "Fehler",
    card_pending: "Ausstehend",
    no_tournaments: "Noch keine Turniere getrackt.",
    no_tournaments_sub: "Füge oben eine Matcherino-Turnier-URL ein, um zu starten.",
    ai_title: "KI fragen",
    ai_subtitle: "Frag mich über deine echten Turnierdaten — Picks, Bans, Win-Rates, Teams.",
    ai_placeholder: "Frag mich über deine Turnier-Daten…",
    ai_hint_enter: "Enter senden",
    ai_hint_shift: "Shift+Enter Zeilenumbruch",
    ai_hint_access: "Zugriff auf alle Match-Daten",
    discord_hint: "Schreib mir bei Fragen,\nVerbesserungsvorschlägen oder Bugs",
  },
} as const;

export type T = typeof translations["en"];

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}>({ lang: "en", setLang: () => {}, t: translations.en });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) ?? "en"; } catch { return "en"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

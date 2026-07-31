import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Swords, Map, Users, UserPlus, Trophy, TrendingUp,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { lang } = useLanguage();

  const cards = [
    {
      href: "/scrims",
      icon: Swords,
      label: lang === "de" ? "Scrims" : "Scrims",
      sub: lang === "de" ? "Tägliche Ergebnisse" : "Daily results",
      color: "text-orange-400",
      border: "hover:border-orange-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.12)]",
      bg: "group-hover:bg-orange-500/5",
      dot: "bg-orange-400",
    },
    {
      href: "/pro-teams",
      icon: Users,
      label: lang === "de" ? "Pro Teams" : "Pro Teams",
      sub: lang === "de" ? "Rangliste" : "Leaderboard",
      color: "text-indigo-400",
      border: "hover:border-indigo-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(99,102,241,0.12)]",
      bg: "group-hover:bg-indigo-500/5",
      dot: "bg-indigo-400",
    },
    {
      href: "/maps",
      icon: Map,
      label: lang === "de" ? "Maps & Meta" : "Maps & Meta",
      sub: lang === "de" ? "Pick/Ban-Statistiken" : "Pick/ban stats",
      color: "text-emerald-400",
      border: "hover:border-emerald-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]",
      bg: "group-hover:bg-emerald-500/5",
      dot: "bg-emerald-400",
    },
    {
      href: "/matcherino",
      icon: Trophy,
      label: "Matcherino",
      sub: lang === "de" ? "Turniere importieren" : "Import tournaments",
      color: "text-violet-400",
      border: "hover:border-violet-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(139,92,246,0.12)]",
      bg: "group-hover:bg-violet-500/5",
      dot: "bg-violet-400",
    },
    /* Custom Team feature temporarily deactivated
    {
      href: "/custom-team",
      icon: UserPlus,
      label: lang === "de" ? "Spieler-Suche" : "Player Search",
      sub: lang === "de" ? "Benutzerdefiniert" : "Custom search",
      color: "text-purple-400",
      border: "hover:border-purple-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(168,85,247,0.12)]",
      bg: "group-hover:bg-purple-500/5",
      dot: "bg-purple-400",
    },
    */
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-border/30 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-5 sm:px-8 pt-14 pb-12 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-primary/8 border border-primary/15"
          >
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-mono font-bold text-primary/80 uppercase tracking-[0.3em]">EMEA Competitive Intel</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-5xl sm:text-6xl font-black font-mono tracking-tighter mb-4"
          >
            Brawl<span className="text-primary">Analytics</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm font-mono text-muted-foreground/60 max-w-sm mx-auto"
          >
            {lang === "de"
              ? "Profi-Scrim-Tracker für BSC EMEA — Picks, Bans, Winrates & Draft-Analyse."
              : "Pro scrim tracker for BSC EMEA — picks, bans, win rates & draft intelligence."}
          </motion.p>
        </div>
      </div>

      {/* ── Nav Cards ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map(({ href, icon: Icon, label, sub, color, border, glow, bg, dot }, i) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link href={href}>
                <div className={`group relative flex items-center gap-4 p-4 rounded-xl border border-border/25 bg-card/15 cursor-pointer transition-all ${border} ${glow} ${bg}`}>
                  {/* Active dot */}
                  <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${dot} opacity-0 group-hover:opacity-60 transition-opacity`} />

                  <div className={`w-10 h-10 rounded-xl bg-card/60 border border-white/6 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>

                  <div className="min-w-0">
                    <div className={`text-[11px] font-mono font-black uppercase tracking-widest ${color}`}>{label}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/45 mt-0.5 truncate">{sub}</div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>

    </div>
  );
}

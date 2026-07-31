import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Plus, Trophy, Activity, AlertCircle, RefreshCw,
  Calendar, ArrowRight, Sparkles, ExternalLink, Users, DollarSign,
} from "lucide-react";
import {
  useAddTournament,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

// ── EU Test List ──────────────────────────────────────────────────────────────

interface EuTournament {
  id: number;
  title: string;
  region: string;
  gameRegionId: number;
  bracketStatus: string;
  startAt: string | null;
  prizePool: string;
  teamsRegistered: number;
  matcherinoLink: string;
  importUrl: string;
}

const REGION_FLAGS: Record<string, string> = {
  "EU/Ireland": "🇮🇪",
  "EU/Italy": "🇮🇹",
  "EU/Germany-1": "🇩🇪",
  "EU/Germany-2": "🇩🇪",
  "EU/Finland": "🇫🇮",
};

function BracketBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Completed
      </span>
    );
  if (status === "in-progress")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-primary/15 text-primary border border-primary/25">
        <Activity className="w-2.5 h-2.5 animate-pulse" /> In Progress
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/5 text-muted-foreground border border-white/10">
      {status}
    </span>
  );
}

const EU_CACHE_KEY = "eu_test_list_cache";

interface EuCache {
  tournaments: EuTournament[];
  fetchedAt: string; // ISO string
}

function EuTestList() {
  const [tournaments, setTournaments] = useState<EuTournament[]>(() => {
    try {
      const raw = sessionStorage.getItem(EU_CACHE_KEY);
      if (!raw) return [];
      const cache: EuCache = JSON.parse(raw);
      return cache.tournaments ?? [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(() => {
    try {
      const raw = sessionStorage.getItem(EU_CACHE_KEY);
      if (!raw) return null;
      const cache: EuCache = JSON.parse(raw);
      return cache.fetchedAt ? new Date(cache.fetchedAt) : null;
    } catch {
      return null;
    }
  });
  const [importingId, setImportingId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const fetchEuTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/corestats/eu-scan");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      const fetched = json.tournaments ?? [];
      const now = new Date();
      setTournaments(fetched);
      setLastFetched(now);
      try {
        const cache: EuCache = { tournaments: fetched, fetchedAt: now.toISOString() };
        sessionStorage.setItem(EU_CACHE_KEY, JSON.stringify(cache));
      } catch { /* quota exceeded — ignore */ }
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCardClick = useCallback(async (t: EuTournament) => {
    if (importingId !== null) return;
    setImportingId(t.id);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: t.importUrl }),
      });
      const data = await res.json();
      const tournamentId = data?.id;
      if (!tournamentId) throw new Error("No tournament ID returned");
      navigate(`/tournaments/${tournamentId}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Failed to import", variant: "destructive" });
    } finally {
      setImportingId(null);
    }
  }, [importingId, navigate, toast]);

  return (
    <section className="max-w-2xl mx-auto px-5 sm:px-8 pt-6 pb-2">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-amber-400/70 uppercase tracking-widest">
            Tournaments
          </span>
          {!loading && tournaments.length > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground/40 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-full">
              {tournaments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-[9px] font-mono text-muted-foreground/30 hidden sm:inline">
              {lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={fetchEuTournaments}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[10px] font-mono font-bold uppercase tracking-widest rounded-lg border transition-colors bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh Data"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Empty / initial state */}
      {!loading && tournaments.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 px-5 py-8 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-amber-400/60" />
          </div>
          <p className="text-xs font-mono font-bold text-amber-400/50 mb-1">Corestats EU Scanner</p>
          <p className="text-[10px] font-mono text-muted-foreground/30 max-w-[220px]">
            Drücke "Refresh Data" um alle EU-Turniere zu laden
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-amber-500/5 border border-amber-500/10 animate-pulse" />
          ))}
        </div>
      )}

      {/* Tournament list */}
      {!loading && tournaments.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div key="eu-list" className="space-y-2">
            {tournaments.map((t, idx) => {
              const isImporting = importingId === t.id;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.5), duration: 0.2 }}
                  onClick={() => handleCardClick(t)}
                  className={`group rounded-xl border transition-all duration-200 px-4 py-3 cursor-pointer select-none ${
                    isImporting
                      ? "border-amber-500/40 bg-amber-500/15"
                      : importingId !== null
                      ? "border-amber-500/10 bg-amber-500/3 opacity-60 pointer-events-none"
                      : "border-amber-500/15 bg-amber-500/5 hover:border-amber-500/35 hover:bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status / loading */}
                    <div className="shrink-0">
                      {isImporting ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Activity className="w-2.5 h-2.5 animate-pulse" /> Importing…
                        </span>
                      ) : (
                        <BracketBadge status={t.bracketStatus} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold font-mono text-foreground/90 group-hover:text-amber-300 transition-colors truncate leading-tight">
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/50">
                        <span>{REGION_FLAGS[t.region] ?? "🌍"} {t.region}</span>
                        {t.startAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(t.startAt).toLocaleDateString("de-DE", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </span>
                        )}
                        {parseFloat(t.prizePool) > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-2.5 h-2.5" />
                            {t.prizePool}
                          </span>
                        )}
                        {t.teamsRegistered > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {t.teamsRegistered}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: arrow */}
                    <div className="shrink-0 flex items-center">
                      <ArrowRight className="w-4 h-4 text-muted-foreground/15 group-hover:text-amber-400/50 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const addSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

export default function MatcherinoPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { lang, t } = useLanguage();

  const addMutation = useAddTournament();

  const form = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { url: "" },
  });

  const onSubmit = (values: z.infer<typeof addSchema>) => {
    addMutation.mutate({ data: { url: values.url } }, {
      onSuccess: (data: any) => {
        toast({ title: lang === "de" ? "Turnier hinzugefügt" : "Tournament Added" });
        form.reset();
        if (data?.id) navigate(`/tournaments/${data.id}`);
      },
      onError: (error: any) => {
        const status = error?.response?.status ?? error?.status;
        if (status === 409) {
          const existing = error?.response?.data ?? error?.data;
          if (existing?.id) {
            form.reset();
            navigate(`/tournaments/${existing.id}`);
            return;
          }
        }
        toast({ title: "Error", description: error.message || "Failed to add tournament", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/25">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(139,92,246,0.12),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 pt-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2 mb-4"
          >
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.2)]">
              <Trophy className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="text-[8px] font-mono font-bold text-violet-400/60 uppercase tracking-[0.35em] leading-none mb-0.5">Tournament Tracker</div>
              <h1 className="text-xl font-black font-mono tracking-tight leading-none">Matcherino</h1>
            </div>
          </motion.div>

          {/* ── URL Input ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.07 }}
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                <FormField control={form.control} name="url" render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <FormControl>
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 pointer-events-none" />
                        <Input
                          placeholder={t.track_placeholder}
                          className="h-11 pl-9 bg-card/30 border-border/40 font-mono text-xs focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/40 transition-colors"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] mt-1" />
                  </FormItem>
                )} />
                <Button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="h-11 px-5 font-mono font-bold bg-violet-600 hover:bg-violet-500 text-white shrink-0 text-xs gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_24px_rgba(139,92,246,0.45)] transition-all"
                >
                  {addMutation.isPending
                    ? <Activity className="w-3.5 h-3.5 animate-pulse" />
                    : <Plus className="w-3.5 h-3.5" />}
                  {addMutation.isPending
                    ? (lang === "de" ? "Lädt…" : "Adding…")
                    : (lang === "de" ? "Hinzufügen" : "Add")}
                </Button>
              </form>
            </Form>

            {/* Hint */}
            <div className="mt-2.5 flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-amber-400/50 shrink-0" />
              <span className="text-[9px] font-mono text-muted-foreground/35">{t.track_hint}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Tournaments ──────────────────────────────────────────────────── */}
      <EuTestList />
    </div>
  );
}

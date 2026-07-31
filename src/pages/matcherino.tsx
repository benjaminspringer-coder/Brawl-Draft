import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Plus, Trophy, Activity, AlertCircle, RefreshCw,
  Calendar, ArrowRight, Sparkles, ExternalLink, Users, DollarSign,
  ChevronLeft, ChevronRight, CheckCircle2, Zap, Database,
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
  inDatabase?: boolean;
  dbId?: number | null;
  dbMatchCount?: number;
  dbStatus?: string | null;
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
const PAGE_SIZE = 10;

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
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
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

  const fetchEuTournaments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial auto fetch if empty
  useEffect(() => {
    if (tournaments.length === 0) {
      fetchEuTournaments();
    }
  }, [tournaments.length, fetchEuTournaments]);

  const handleSyncAllDrafts = useCallback(async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/corestats/sync-all-drafts", {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to sync drafts");
      toast({
        title: "Drafts-Sync gestartet",
        description: `${data.newlyImported} neue Turniere geladen, ${data.reQueued} in Aktualisierung.`,
      });
      await fetchEuTournaments(true);
    } catch (err: any) {
      toast({
        title: "Fehler beim Sync",
        description: err.message || "Failed to sync all drafts",
        variant: "destructive",
      });
    } finally {
      setSyncingAll(false);
    }
  }, [fetchEuTournaments, toast]);

  const handleCardClick = useCallback(async (t: EuTournament) => {
    if (importingId !== null) return;
    if (t.inDatabase && t.dbId && (t.dbMatchCount ?? 0) > 0) {
      navigate(`/tournaments/${t.dbId}`);
      return;
    }
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
      // Refresh list to update DB match count
      fetchEuTournaments(true);
      navigate(`/tournaments/${tournamentId}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Failed to import", variant: "destructive" });
    } finally {
      setImportingId(null);
    }
  }, [importingId, navigate, toast, fetchEuTournaments]);

  // Pagination calculation
  const totalEvents = tournaments.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalEvents);
  const currentEvents = useMemo(
    () => tournaments.slice(startIdx, endIdx),
    [tournaments, startIdx, endIdx]
  );

  const inDbCount = useMemo(
    () => tournaments.filter((t) => t.inDatabase && (t.dbMatchCount ?? 0) > 0).length,
    [tournaments]
  );

  return (
    <section className="max-w-4xl mx-auto px-5 sm:px-8 pt-6 pb-12">
      {/* Header bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-card/40 border border-border/40 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                Matcherino EU Tournaments
              </span>
              {!loading && totalEvents > 0 && (
                <span className="text-[10px] font-mono font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                  {totalEvents} Turniere
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground/80 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Database className="w-3 h-3" />
                {inDbCount} / {totalEvents} in DB geladen
              </span>
              {lastFetched && (
                <span>
                  • Stand: {lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAllDrafts}
            disabled={syncingAll || loading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-mono font-bold rounded-xl border transition-all bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Lädt alle Drafts aller EU Turniere automatisch in die Datenbank"
          >
            <Zap className={`w-3.5 h-3.5 ${syncingAll ? "animate-pulse" : ""}`} />
            {syncingAll ? "Synchronisiere Drafts…" : "Alle Drafts in DB synchronisieren"}
          </button>

          <button
            onClick={() => fetchEuTournaments()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-mono font-bold rounded-xl border transition-all bg-violet-500/10 border-violet-500/25 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Lädt…" : "Aktualisieren"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Fehler beim Laden der Turniere</div>
            <div className="text-[11px] opacity-80 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Empty / initial state */}
      {!loading && totalEvents === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/5 px-5 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-mono font-bold text-violet-300 mb-1">Keine Turniere gefunden</p>
          <p className="text-xs font-mono text-muted-foreground/60 max-w-[280px]">
            Drücke "Aktualisieren", um alle EU-Turniere von Matcherino und Corestats abzurufen.
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-18 rounded-xl bg-violet-500/5 border border-violet-500/10 animate-pulse" />
          ))}
        </div>
      )}

      {/* Top Pagination Control */}
      {!loading && totalEvents > 0 && (
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-mono text-muted-foreground">
            Zeige Event <span className="font-bold text-foreground">{startIdx + 1}–{endIdx}</span> von{" "}
            <span className="font-bold text-foreground">{totalEvents}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück
            </button>
            <span className="text-xs font-mono px-2 py-1 bg-card/60 border rounded-lg">
              Seite <strong className="text-foreground">{currentPage}</strong> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tournament list */}
      {!loading && totalEvents > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`page-${currentPage}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-2.5"
          >
            {currentEvents.map((t, idx) => {
              const isImporting = importingId === t.id;
              const hasDraftsInDb = t.inDatabase && (t.dbMatchCount ?? 0) > 0;

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.4), duration: 0.2 }}
                  onClick={() => handleCardClick(t)}
                  className={`group rounded-xl border transition-all duration-200 px-4 py-3.5 cursor-pointer select-none ${
                    isImporting
                      ? "border-amber-500/40 bg-amber-500/15"
                      : hasDraftsInDb
                      ? "border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/45 hover:bg-emerald-500/10"
                      : "border-border/50 bg-card/40 hover:border-violet-500/40 hover:bg-violet-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="shrink-0">
                        {isImporting ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Activity className="w-3 h-3 animate-pulse" /> Lade Drafts…
                          </span>
                        ) : (
                          <BracketBadge status={t.bracketStatus} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold font-mono text-foreground group-hover:text-violet-300 transition-colors truncate">
                            {t.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
                          <span className="text-foreground/80 font-semibold">{REGION_FLAGS[t.region] ?? "🌍"} {t.region}</span>
                          {t.startAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-violet-400/80" />
                              {new Date(t.startAt).toLocaleDateString("de-DE", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </span>
                          )}
                          {parseFloat(t.prizePool) > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400/90 font-semibold">
                              <DollarSign className="w-3 h-3" />
                              {t.prizePool}
                            </span>
                          )}
                          {t.teamsRegistered > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-amber-400/80" />
                              {t.teamsRegistered} Teams
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: DB Status & arrow */}
                    <div className="shrink-0 flex items-center gap-3">
                      {hasDraftsInDb ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {t.dbMatchCount} Drafts in DB
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300/90 border border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/40 transition-all">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Drafts laden
                        </span>
                      )}

                      <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-colors">
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom Pagination Control */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/30">
          <span className="text-xs font-mono text-muted-foreground">
            Seite <strong className="text-foreground">{currentPage}</strong> von {totalPages}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Erste
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück
            </button>

            {/* Page buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 7 && currentPage > 4) {
                  pageNum = currentPage - 3 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (6 - i);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-xs font-mono font-bold rounded-lg border transition-colors flex items-center justify-center ${
                      currentPage === pageNum
                        ? "bg-violet-600 text-white border-violet-500 shadow-sm"
                        : "bg-card hover:bg-accent border-border/50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Letzte
            </button>
          </div>
        </div>
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

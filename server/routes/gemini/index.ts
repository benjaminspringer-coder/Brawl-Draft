import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { matchesTable, tournamentsTable } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const SYSTEM_PROMPT = `You are an expert esports draft analyst. You analyze competitive match drafts, picks, and bans.
When analyzing a draft, consider:
- Team composition synergies and counters
- Ban patterns and what they reveal about strategy
- Pick order and priorities
- Map-specific considerations
- Meta trends and power picks
Be concise, insightful, and use esports terminology. Format your response clearly.`;

router.get("/gemini/conversations", async (req, res) => {
  try {
    const list = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/gemini/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) { res.status(400).json({ error: "title required" }); return; }
    const [conv] = await db.insert(conversations).values({ title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "content required" }); return; }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.insert(messages).values({ conversationId: convId, role: "user", content });

    const history = await db.select().from(messages).where(eq(messages.conversationId, convId)).orderBy(asc(messages.createdAt));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

router.post("/gemini/analyze", async (req, res) => {
  try {
    const { matchId, extraContext } = req.body;
    if (!matchId) { res.status(400).json({ error: "matchId required" }); return; }

    const [match] = await db
      .select({
        id: matchesTable.id,
        team1Name: matchesTable.team1Name,
        team2Name: matchesTable.team2Name,
        winnerName: matchesTable.winnerName,
        score: matchesTable.score,
        roundName: matchesTable.roundName,
        maps: matchesTable.maps,
        tournamentName: tournamentsTable.name,
      })
      .from(matchesTable)
      .innerJoin(tournamentsTable, eq(matchesTable.tournamentId, tournamentsTable.id))
      .where(eq(matchesTable.id, matchId));

    if (!match) { res.status(404).json({ error: "Match not found" }); return; }

    const draftSummary = JSON.stringify(match, null, 2);
    const prompt = `Analyze this esports match draft:

${draftSummary}

${extraContext ? `Additional context: ${extraContext}` : ""}

Provide a concise analysis covering:
1. Ban phase strategy for each team
2. Pick composition and synergies
3. Key matchup considerations
4. Overall draft assessment`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

function buildAggregatedContext(
  tournaments: { id: number; name: string; slug: string | null; matchCount: number | null; gameName: string | null }[],
  matches: { tournamentName: string; team1Name: string | null; team2Name: string | null; winnerName: string | null; roundName: string | null; maps: unknown }[]
): string {
  // Brawler stats
  const brawlerPicks: Record<string, { picks: number; wins: number; bans: number }> = {};
  // Team stats
  const teamStats: Record<string, { wins: number; losses: number }> = {};
  // Match list (compact)
  const matchList: string[] = [];

  for (const match of matches) {
    const maps = (Array.isArray(match.maps) ? match.maps : []) as {
      bans?: { value: string; team: string }[];
      picks?: { value: string; team: string; playerName?: string | null }[];
      winner?: string;
    }[];

    const t1 = match.team1Name ?? "?";
    const t2 = match.team2Name ?? "?";
    const winner = match.winnerName ?? "?";

    // Team stats
    if (match.team1Name) {
      if (!teamStats[t1]) teamStats[t1] = { wins: 0, losses: 0 };
      if (!teamStats[t2]) teamStats[t2] = { wins: 0, losses: 0 };
      if (winner === t1) { teamStats[t1].wins++; teamStats[t2].losses++; }
      else if (winner === t2) { teamStats[t2].wins++; teamStats[t1].losses++; }
    }

    matchList.push(`${match.tournamentName} | ${match.roundName ?? "-"} | ${t1} vs ${t2} → ${winner}`);

    for (const map of maps) {
      const mapWinner = map.winner ?? winner;
      for (const pick of map.picks ?? []) {
        const brawler = pick.value.toUpperCase();
        if (!brawlerPicks[brawler]) brawlerPicks[brawler] = { picks: 0, wins: 0, bans: 0 };
        brawlerPicks[brawler].picks++;
        if (pick.team === mapWinner) brawlerPicks[brawler].wins++;
      }
      for (const ban of map.bans ?? []) {
        const brawler = ban.value.toUpperCase();
        if (!brawlerPicks[brawler]) brawlerPicks[brawler] = { picks: 0, wins: 0, bans: 0 };
        brawlerPicks[brawler].bans++;
      }
    }
  }

  // Top brawlers sorted by total presence
  const brawlerRows = Object.entries(brawlerPicks)
    .map(([name, s]) => ({
      name,
      picks: s.picks,
      bans: s.bans,
      wins: s.wins,
      winRate: s.picks > 0 ? Math.round((s.wins / s.picks) * 100) : 0,
      presence: s.picks + s.bans,
    }))
    .sort((a, b) => b.presence - a.presence);

  const brawlerTable = brawlerRows
    .map((b) => `${b.name}: picks=${b.picks} bans=${b.bans} wins=${b.wins} winRate=${b.winRate}%`)
    .join("\n");

  const teamTable = Object.entries(teamStats)
    .sort((a, b) => b[1].wins - a[1].wins)
    .map(([t, s]) => `${t}: W=${s.wins} L=${s.losses} (${s.wins + s.losses} matches)`)
    .join("\n");

  return `## LIVE AGGREGATED TOURNAMENT DATA

### Tournaments (${tournaments.length}):
${tournaments.map((t) => `- ${t.name} (${t.gameName ?? "?"}) — ${t.matchCount ?? "?"} matches`).join("\n")}

### Brawler Statistics (${brawlerRows.length} unique brawlers):
Format: NAME: picks=N bans=N wins=N winRate=N%
${brawlerTable}

### Team Standings (${Object.keys(teamStats).length} teams):
${teamTable}

### Match Results (${matchList.length} total):
${matchList.join("\n")}

Use the above pre-computed stats to answer questions. Do NOT claim you lack access to data.`;
}

router.post("/gemini/chat", async (req, res) => {
  try {
    const { message, history } = req.body as {
      message: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    const [allTournaments, allMatches] = await Promise.all([
      db.select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        slug: tournamentsTable.slug,
        matchCount: tournamentsTable.matchCount,
        gameName: tournamentsTable.gameName,
      }).from(tournamentsTable),
      db.select({
        tournamentName: tournamentsTable.name,
        team1Name: matchesTable.team1Name,
        team2Name: matchesTable.team2Name,
        winnerName: matchesTable.winnerName,
        roundName: matchesTable.roundName,
        maps: matchesTable.maps,
      })
      .from(matchesTable)
      .innerJoin(tournamentsTable, eq(matchesTable.tournamentId, tournamentsTable.id)),
    ]);

    const contextBlock = buildAggregatedContext(allTournaments, allMatches);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${contextBlock}`;

    const chatHistory = (history ?? []).map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));
    chatHistory.push({ role: "user", parts: [{ text: message }] });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatHistory,
      config: { systemInstruction: systemPrompt, maxOutputTokens: 4096 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

export default router;

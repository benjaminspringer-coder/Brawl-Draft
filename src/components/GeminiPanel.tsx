import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };

interface GeminiPanelProps {
  matchId?: number;
  matchLabel?: string;
}

export function GeminiPanel({ matchId, matchLabel }: GeminiPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const streamResponse = async (url: string, body: object, onDone?: () => void) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              full += data.content;
              setStreamingContent(full);
            }
            if (data.done) {
              setStreamingContent("");
              setMessages((prev) => [...prev, { role: "assistant", content: full }]);
              onDone?.();
            }
            if (data.error) throw new Error(data.error);
          } catch {}
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!matchId || analyzing) return;
    setAnalyzing(true);
    setOpen(true);
    const prompt = `Please analyze the draft for match ID ${matchId}${matchLabel ? ` (${matchLabel})` : ""}.`;
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    try {
      await streamResponse("/api/gemini/analyze", { matchId }, () => setAnalyzing(false));
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
      setAnalyzing(false);
    }
    setStreamingContent("");
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);

    const convId = await ensureConversation();
    if (!convId) { setLoading(false); return; }

    try {
      await streamResponse(`/api/gemini/conversations/${convId}/messages`, { content }, () => setLoading(false));
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
      setLoading(false);
    }
    setStreamingContent("");
  };

  const conversationIdRef = useRef<number | null>(null);

  const ensureConversation = async (): Promise<number | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const res = await fetch("/api/gemini/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: matchLabel ? `Draft: ${matchLabel}` : "Draft Analysis" }),
      });
      const conv = await res.json();
      conversationIdRef.current = conv.id;
      return conv.id;
    } catch {
      return null;
    }
  };

  const handleClear = () => {
    setMessages([]);
    setStreamingContent("");
    conversationIdRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isStreaming = loading || analyzing;

  return (
    <>
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
        {matchId && !open && (
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            size="sm"
            className="bg-purple-700 hover:bg-purple-600 text-white font-mono text-xs shadow-lg border border-purple-500/40"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {analyzing ? "Analyzing…" : "Analyze Draft"}
          </Button>
        )}
        <Button
          onClick={() => setOpen((o) => !o)}
          size="icon"
          className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 shadow-xl border border-blue-400/20"
        >
          {open ? <ChevronDown className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </Button>
      </div>

      {open && (
        <div className="fixed bottom-24 right-6 w-[380px] max-h-[560px] flex flex-col bg-[#0e0e14] border border-border/60 rounded-xl shadow-2xl z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-blue-950/40 to-purple-950/40">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-mono font-semibold text-white">Gemini Draft AI</span>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-purple-400 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {matchId && (
                <Button variant="ghost" size="icon" className="w-7 h-7 text-purple-400 hover:text-purple-300" onClick={handleAnalyze} disabled={analyzing} title="Analyze current draft">
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-white" onClick={handleClear} title="Clear chat">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-white" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 max-h-[400px]">
            {messages.length === 0 && !streamingContent && (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/50 font-mono">
                  {matchId ? "Click ✨ to auto-analyze this draft, or ask a question below." : "Ask me anything about drafts and esports strategy."}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-700/60 text-blue-100 border border-blue-600/30"
                    : "bg-card/80 text-foreground/90 border border-border/40"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-purple-400 font-mono">
                      <Bot className="w-3 h-3" /> Gemini
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed bg-card/80 text-foreground/90 border border-border/40">
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-purple-400 font-mono">
                    <Bot className="w-3 h-3" /> Gemini
                  </div>
                  <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
                  <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse ml-0.5" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border/40">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about picks, bans, strategy…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/60 font-mono disabled:opacity-50"
                style={{ minHeight: "36px", maxHeight: "80px" }}
              />
              <Button
                size="icon"
                className="w-8 h-8 shrink-0 bg-blue-600 hover:bg-blue-500"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground/30 font-mono mt-1">Enter to send · Shift+Enter for newline</p>
          </div>
        </div>
      )}
    </>
  );
}

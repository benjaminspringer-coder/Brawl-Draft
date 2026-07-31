import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type Message = { role: "user" | "assistant"; content: string };

export function GeminiInline() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setLoading(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.content) {
              full += data.content;
              setStreamingContent(full);
            }
            if (data.done) {
              setStreamingContent("");
              setMessages([...nextMessages, { role: "assistant", content: full }]);
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages([...nextMessages, { role: "assistant", content: `Connection error: ${err}` }]);
    } finally {
      setLoading(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setStreamingContent("");
  };

  const suggestions = [
    "Most picked brawlers across all tournaments",
    "Best ban candidates by win rate",
    "Which teams are performing best?",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[#0e0e18] to-[#0a0a14] overflow-hidden shadow-2xl shadow-purple-900/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/10 bg-gradient-to-r from-blue-950/40 to-purple-950/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-mono font-semibold text-white">Gemini Draft AI</span>
          <span className="text-[9px] font-mono text-green-400/60 bg-green-900/20 px-1.5 py-0.5 rounded-full border border-green-500/10">live data</span>
          {loading && (
            <span className="flex items-center gap-1 text-[10px] text-purple-400 font-mono">
              <Loader2 className="w-3 h-3 animate-spin" /> analyzing…
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground/50 hover:text-muted-foreground" onClick={handleClear}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-[200px] max-h-[360px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-36 gap-3">
            <Sparkles className="w-8 h-8 text-purple-400/40" />
            <p className="text-xs text-muted-foreground/40 font-mono text-center">
              Ask me about your real tournament data — picks, bans, win rates, teams.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-[11px] font-mono px-3 py-1 rounded-full border border-purple-500/20 text-purple-300/60 hover:border-purple-500/50 hover:text-purple-300 transition-colors bg-purple-950/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600/50 text-blue-100 border border-blue-500/20"
                  : "bg-white/5 text-foreground/90 border border-white/5"
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {streamingContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed bg-white/5 text-foreground/90 border border-white/5">
              <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
              <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse ml-0.5 align-middle" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-purple-500/40 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about your tournament data…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none font-mono disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "72px" }}
          />
          <Button
            size="icon"
            className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground/20 font-mono mt-1.5 text-center">Enter to send · Shift+Enter for new line · Access to all match data</p>
      </div>
    </motion.div>
  );
}

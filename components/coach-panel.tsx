"use client";
import { useEffect, useRef, useState } from "react";

type Mode = "socratic" | "hints";
type Msg = { role: "user" | "assistant"; content: string; mode: Mode };

export function CoachPanel({
  problemId,
  code,
  lastRunOutput,
  open,
  onClose,
}: {
  problemId: number;
  code: string;
  lastRunOutput: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<Mode>("hints");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/coach?problemId=${problemId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {});
  }, [open, problemId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, mode }]);
    setMessages((m) => [...m, { role: "assistant", content: "", mode }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          mode,
          userMessage: text,
          code,
          lastRunOutput,
        }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const events = pending.split("\n\n");
        pending = events.pop() ?? "";
        for (const raw of events) {
          if (!raw.startsWith("data: ")) continue;
          const ev = JSON.parse(raw.slice(6));
          if (ev.type === "delta" || ev.type === "blocked") {
            setMessages((msgs) => {
              const next = msgs.slice();
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: ev.type === "blocked" ? ev.text : last.content + ev.text,
                };
              }
              return next;
            });
          }
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  if (!open) return null;
  return (
    <aside className="fixed right-0 top-0 h-screen w-96 bg-zinc-950 border-l border-zinc-800 flex flex-col z-40">
      <header className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Coach</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
          >
            <option value="hints">Hints</option>
            <option value="socratic">Socratic</option>
          </select>
        </div>
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-100">
          Close
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask a question to get unstuck. The coach won&apos;t hand you a full solution.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm whitespace-pre-wrap rounded p-2 ${
              m.role === "user" ? "bg-zinc-900 text-zinc-100" : "bg-zinc-900/50 text-zinc-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
              {m.role}
            </div>
            {m.content || (m.role === "assistant" ? "…" : "")}
          </div>
        ))}
      </div>
      <footer className="p-3 border-t border-zinc-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask the coach…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm"
          disabled={streaming}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-3 py-1.5 rounded bg-white text-black text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </footer>
    </aside>
  );
}

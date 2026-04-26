"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Icon, IconButton, Kbd, type IconName } from "@/components/ui";

type Mode = "hints" | "socratic" | "style" | "interview";

const MODES: { id: Mode; label: string; icon: IconName }[] = [
  { id: "hints", label: "Hints", icon: "sparkle" },
  { id: "socratic", label: "Socratic", icon: "target" },
  { id: "style", label: "Style", icon: "beaker" },
  { id: "interview", label: "Interview", icon: "briefcase" },
];

const SLASH_COMMANDS: { id: string; hint: string }[] = [
  { id: "/hint", hint: "nudge without spoiling" },
  { id: "/explain", hint: "walk through approach" },
  { id: "/review", hint: "critique my code" },
  { id: "/complexity", hint: "time / space analysis" },
];

type Msg = { role: "user" | "assistant"; content: string; mode: Mode };

const MIN_WIDTH = 320;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 380;
const STORAGE_KEY = "lcn-coach-width";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function CoachPanel({
  problemId,
  code,
  lastRunOutput,
  open,
  onClose,
  lockedMode,
}: {
  problemId: number;
  code: string;
  lastRunOutput: string | null;
  open: boolean;
  onClose: () => void;
  lockedMode?: Mode;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<Mode>(lockedMode ?? "hints");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) return clamp(n, MIN_WIDTH, MAX_WIDTH);
      }
    } catch {}
    return DEFAULT_WIDTH;
  });
  const sentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Lock mode when locked: derive effective mode at render time
  const effectiveMode: Mode = lockedMode ?? mode;

  // Load history when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    sentRef.current = false;
    fetch(`/api/coach?problemId=${problemId}`)
      .then((r) => r.json())
      .then((d: { messages?: Msg[] }) => {
        if (cancelled || sentRef.current) return;
        setMessages(d.messages ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, problemId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  // Resize handlers
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = d.startX - e.clientX;
      const next = clamp(d.startW + dx, MIN_WIDTH, MAX_WIDTH);
      setWidth(next);
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      try {
        window.localStorage.setItem(STORAGE_KEY, String(width));
      } catch {}
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    document.body.style.cursor = "ew-resize";
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const effectiveMode: Mode = lockedMode ?? mode;
    sentRef.current = true;
    setInput("");
    setShowSlash(false);
    setMessages((m) => [
      ...m,
      { role: "user", content: text, mode: effectiveMode },
      { role: "assistant", content: "", mode: effectiveMode },
    ]);
    setStreaming(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          mode: effectiveMode,
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
          const ev = JSON.parse(raw.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "blocked"; text: string }
            | { type: "error"; text: string };
          if (ev.type === "delta" || ev.type === "blocked") {
            setMessages((msgs) => {
              const next = msgs.slice();
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content:
                    ev.type === "blocked" ? ev.text : last.content + ev.text,
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

  const filteredSlash = SLASH_COMMANDS.filter((s) => s.id.startsWith(input));

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        background: "var(--surface-glass)",
        height: "100%",
        position: "relative",
        borderLeft: "1px solid var(--border)",
      }}
    >
      <div
        onMouseDown={startResize}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 4,
          height: "100%",
          cursor: "ew-resize",
          zIndex: 5,
        }}
        aria-label="Resize coach"
      />
      <div className="col" style={{ height: "100%", minHeight: 0 }}>
        <div
          className="row"
          style={{
            height: 40,
            padding: "0 12px",
            borderBottom: "1px solid var(--border)",
            gap: 8,
            background: "var(--surface-glass-strong)",
          }}
        >
          <span
            className="row"
            style={{ gap: 6, fontSize: 12.5, fontWeight: 600 }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-active))",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Icon name="sparkle" size={11} />
            </span>
            Coach
          </span>
          <span className="muted mono" style={{ fontSize: 10.5 }}>
            haiku-4-5
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ display: "inline-flex" }}>
            <Kbd>⌘J</Kbd>
          </span>
          <IconButton icon="x" sm onClick={onClose} title="Close coach" />
        </div>
        <div
          className="row"
          style={{
            padding: "10px 12px",
            gap: 6,
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          {MODES.map((m) => {
            const active = effectiveMode === m.id;
            const isLocked = !!lockedMode;
            const dimmed = isLocked && !active;
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (!isLocked) setMode(m.id);
                }}
                disabled={isLocked}
                type="button"
                className="row"
                style={{
                  gap: 5,
                  height: 24,
                  padding: "0 9px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: active ? "var(--accent-ring)" : "var(--border)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active
                    ? "var(--accent)"
                    : dimmed
                      ? "var(--text-faint)"
                      : "var(--text-muted)",
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: isLocked ? "not-allowed" : "pointer",
                }}
              >
                <Icon name={m.icon} size={11} /> {m.label}
              </button>
            );
          })}
          {lockedMode && (
            <span
              className="row mono"
              style={{ gap: 4, color: "var(--text-faint)", fontSize: 10.5 }}
            >
              <Icon name="lock" size={10} /> locked
            </span>
          )}
        </div>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.length === 0 && !streaming && (
            <p
              className="muted"
              style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}
            >
              Ask a question to get unstuck. The coach won&apos;t hand you a full
              solution — try <span className="mono">/hint</span> or{" "}
              <span className="mono">/explain</span>.
            </p>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isLastAssistant =
              !isUser && i === messages.length - 1 && streaming;
            return (
              <div
                key={i}
                className="anim-fade-in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    background: isUser ? "var(--accent-soft)" : "var(--surface)",
                    border: "1px solid",
                    borderColor: isUser
                      ? "var(--accent-ring)"
                      : "var(--border)",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--text)",
                  }}
                >
                  {m.content ? (
                    <ReactMarkdown
                      components={{
                        code: ({ children, ...props }) => (
                          <code
                            className="mono"
                            style={{
                              background: "var(--bg-2)",
                              padding: "1px 5px",
                              borderRadius: 4,
                              fontSize: 12,
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre
                            className="mono"
                            style={{
                              marginTop: 8,
                              marginBottom: 0,
                              padding: "8px 10px",
                              background: "var(--bg-2)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              overflow: "auto",
                            }}
                          >
                            {children}
                          </pre>
                        ),
                        p: ({ children }) => (
                          <p style={{ margin: "0 0 6px" }}>{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                            {children}
                          </ul>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="muted">…</span>
                  )}
                  {isLastAssistant && (
                    <span
                      className="caret"
                      style={{ height: "0.9em", marginLeft: 2 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 12px",
            position: "relative",
          }}
        >
          {showSlash && filteredSlash.length > 0 && (
            <div
              className="glass anim-slide-up"
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: "calc(100% - 4px)",
                borderRadius: 10,
                padding: 6,
                boxShadow: "var(--shadow-pop)",
                zIndex: 5,
              }}
            >
              {filteredSlash.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setInput(s.id + " ");
                    setShowSlash(false);
                    inputRef.current?.focus();
                  }}
                  className="row"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 9px",
                    borderRadius: 6,
                    border: 0,
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <span
                    className="mono"
                    style={{ color: "var(--accent)", fontWeight: 600 }}
                  >
                    {s.id}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div
            className="row glass"
            style={{
              padding: "6px 6px 6px 10px",
              borderRadius: 10,
              gap: 6,
              background: "var(--surface)",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSlash(e.target.value.startsWith("/"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask the coach… (/  for commands)"
              className="mono"
              disabled={streaming}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: "transparent",
                fontSize: 12.5,
                color: "var(--text)",
                height: 28,
              }}
            />
            <IconButton
              icon="send"
              sm
              onClick={send}
              title="Send"
              disabled={streaming || !input.trim()}
              style={{ color: "var(--accent)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

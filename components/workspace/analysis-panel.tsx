"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, IconButton, Pill, toast } from "@/components/ui";
import type { Analysis } from "@/lib/analysis/repo";
import { AnalysisContent } from "@/components/analysis/analysis-content";

type AttemptSummary = {
  id: number;
  status: "passed" | "failed" | "error";
  created_at: number;
  runtime_ms: number | null;
};

function timeAgo(epochSec: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - epochSec);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AnalysisPanel({
  attemptId,
  problemId,
  problemSlug,
  onClose,
}: {
  attemptId: number;
  problemId: number;
  problemSlug?: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Analysis[]>([]);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const incomplete =
    rows.length === 0 || rows.some((r) => r.status === "pending");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/analysis/${attemptId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: Analysis[] };
        if (!cancelled) setRows(data.rows);
      } catch {}
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  useEffect(() => {
    if (!incomplete) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${attemptId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: Analysis[] };
        setRows(data.rows);
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [attemptId, incomplete]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attempts?problemId=${problemId}&limit=10`)
      .then((r) => (r.ok ? r.json() : { attempts: [] }))
      .then((d: { attempts: AttemptSummary[] }) => {
        if (!cancelled) setHistory(d.attempts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [problemId, attemptId]);

  const showInterviewDebrief = rows.some((r) => r.kind === "interview_debrief");

  return (
    <div
      className="col"
      style={{ height: "100%", minHeight: 0, position: "relative" }}
    >
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
        <span style={{ display: "inline-flex", color: "var(--accent)" }}>
          <Icon name="spark" size={14} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Analysis</span>
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="row btn btn-sm btn-ghost"
          style={{ height: 22, padding: "0 7px", fontSize: 11, gap: 4 }}
        >
          <span className="mono">a-{attemptId}</span>
          <Icon name="chevron-d" size={10} />
        </button>
        {historyOpen && history.length > 0 && (
          <div
            className="glass anim-slide-up"
            style={{
              position: "absolute",
              top: 38,
              left: 60,
              zIndex: 5,
              padding: 4,
              borderRadius: 8,
              boxShadow: "var(--shadow-pop)",
              minWidth: 220,
            }}
          >
            {history.map((h) => (
              <Link
                key={h.id}
                href={`/analysis/${h.id}`}
                onClick={() => setHistoryOpen(false)}
                className="row"
                style={{
                  width: "100%",
                  padding: "7px 9px",
                  gap: 8,
                  borderRadius: 6,
                  fontSize: 12.5,
                  color: "var(--text)",
                  textDecoration: "none",
                  background: h.id === attemptId ? "var(--bg-2)" : "transparent",
                }}
              >
                <span className="mono" style={{ color: "var(--text-faint)" }}>
                  a-{h.id}
                </span>
                <span style={{ flex: 1 }}>{timeAgo(h.created_at)}</span>
                <Pill kind={h.status === "passed" ? "easy" : "hard"}>
                  {h.status === "passed"
                    ? "Accepted"
                    : h.status === "error"
                      ? "Error"
                      : "Wrong"}
                </Pill>
              </Link>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <Link
          href={`/analysis/${attemptId}`}
          className="row btn btn-sm btn-ghost"
          style={{ fontSize: 11, gap: 4 }}
        >
          Open <Icon name="arrow-r" size={11} />
        </Link>
        <IconButton icon="x" sm onClick={onClose} title="Close" />
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px 24px",
        }}
      >
        <AnalysisContent
          rows={rows}
          showInterviewDebrief={showInterviewDebrief}
          nextSteps={
            <div className="col" style={{ gap: 6 }}>
              {problemSlug && (
                <Link
                  href={`/problem/${problemSlug}`}
                  className="row btn btn-sm"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>Open in workspace</span>
                  <Icon name="arrow-r" size={12} />
                </Link>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ justifyContent: "flex-start" }}
                onClick={() =>
                  toast("Quizzes coming soon — for now, ask the coach.", {
                    kind: "info",
                  })
                }
              >
                <Icon name="sparkle" size={12} /> Quiz me on this pattern
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}

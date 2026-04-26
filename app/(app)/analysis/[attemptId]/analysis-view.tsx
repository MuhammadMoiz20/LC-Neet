"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Analysis } from "@/lib/analysis/repo";
import { Icon } from "@/components/ui";
import {
  AnalysisContent,
  AnalysisHeroPill,
  parseGrade,
} from "@/components/analysis/analysis-content";

type AttemptStatus = "passed" | "failed" | "error";

function timeAgo(epochSec: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - epochSec);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusToVerdict(s: AttemptStatus): "Accepted" | "Wrong" | "Error" {
  return s === "passed" ? "Accepted" : s === "error" ? "Error" : "Wrong";
}

export function AnalysisView({
  attemptId,
  problemId,
  problemSlug,
  problemTitle,
  attemptStatus,
  runtimeMs,
  createdAt,
  initial,
}: {
  attemptId: number;
  problemId: number;
  problemSlug: string;
  problemTitle: string;
  attemptStatus: AttemptStatus;
  runtimeMs: number | null;
  createdAt: number;
  initial: Analysis[];
}) {
  const [rows, setRows] = useState<Analysis[]>(initial);
  const [rerunning, setRerunning] = useState(false);

  const showInterviewDebrief = rows.some((r) => r.kind === "interview_debrief");
  const expectedKinds = showInterviewDebrief ? 7 : 6;
  const gradeRow = rows.find((r) => r.kind === "grade");
  const grade =
    gradeRow && gradeRow.status === "done" ? parseGrade(gradeRow.content_md) : null;
  const incomplete =
    rerunning ||
    rows.length < expectedKinds ||
    rows.some((r) => r.status === "pending");

  async function rerun() {
    if (rerunning) return;
    setRerunning(true);
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: "pending" as const, content_md: "" })),
    );
    try {
      const res = await fetch(`/api/analysis/${attemptId}?force=1`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { rows: Analysis[] };
        setRows(data.rows);
      }
    } catch {
    } finally {
      setRerunning(false);
    }
  }

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

  const verdict = statusToVerdict(attemptStatus);

  return (
    <main
      style={{
        flex: 1,
        overflow: "auto",
        padding: "24px 32px 40px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/"
          className="row mono"
          style={{
            gap: 6,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 14,
          }}
        >
          <Icon name="chevron-l" size={12} /> Dashboard
        </Link>
        <div
          className="row"
          style={{ alignItems: "flex-end", marginBottom: 18, gap: 12 }}
        >
          <div className="col" style={{ gap: 6 }}>
            <span className="row" style={{ gap: 6 }}>
              <AnalysisHeroPill verdict={verdict} />
              <span className="mono muted" style={{ fontSize: 11.5 }}>
                a-{attemptId} · {timeAgo(createdAt)}
                {runtimeMs != null && ` · ${runtimeMs}ms`}
              </span>
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-.015em",
              }}
            >
              {problemTitle}
            </h1>
          </div>
          <div style={{ flex: 1 }} />
          <Link
            href={`/problem/${problemSlug}`}
            className="btn btn-sm row"
            style={{ gap: 6 }}
          >
            Open in workspace <Icon name="arrow-r" size={11} />
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 18,
          }}
        >
          <div className="col" style={{ gap: 18 }}>
            <div className="glass" style={{ padding: 22, borderRadius: 12 }}>
              <AnalysisContent
                rows={rows}
                showInterviewDebrief={showInterviewDebrief}
              />
            </div>
          </div>
          <div className="col" style={{ gap: 18 }}>
            <div className="glass" style={{ padding: 22, borderRadius: 12 }}>
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  fontWeight: 600,
                }}
              >
                Metrics
              </h3>
              <div className="col" style={{ gap: 10 }}>
                <GradeBadge grade={grade} />
                <MetricRow label="Verdict" value={verdict} />
                <MetricRow
                  label="Runtime"
                  value={runtimeMs != null ? `${runtimeMs}ms` : "—"}
                />
                <MetricRow label="Attempt" value={`#${attemptId}`} />
              </div>
            </div>
            <div className="glass" style={{ padding: 22, borderRadius: 12 }}>
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  fontWeight: 600,
                }}
              >
                Next steps
              </h3>
              <div className="col" style={{ gap: 6 }}>
                <button
                  type="button"
                  onClick={rerun}
                  disabled={rerunning}
                  className="row btn btn-sm"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>{rerunning ? "Rerunning…" : "Rerun analysis"}</span>
                  <Icon name={rerunning ? "spark" : "reset"} size={12} />
                </button>
                <Link
                  href={`/problem/${problemSlug}`}
                  className="row btn btn-sm btn-ghost"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>Re-open workspace</span>
                  <Icon name="arrow-r" size={12} />
                </Link>
                <Link
                  href={`/problems?problemId=${problemId}`}
                  className="row btn btn-sm btn-ghost"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>Browse similar problems</span>
                  <Icon name="arrow-r" size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function gradeColor(g: number): string {
  if (g >= 9) return "var(--accepted, #34d399)";
  if (g >= 7) return "var(--accent, #2dd4bf)";
  if (g >= 4) return "var(--text)";
  return "var(--rose, #fb7185)";
}

function GradeBadge({ grade }: { grade: number | null }) {
  return (
    <div
      className="row"
      style={{
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-2)",
      }}
    >
      <span
        className="muted"
        style={{
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Smart grade
      </span>
      <span
        className="row"
        style={{ alignItems: "baseline", gap: 2 }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            color: grade != null ? gradeColor(grade) : "var(--text-faint)",
          }}
        >
          {grade != null ? grade : "—"}
        </span>
        <span
          className="muted"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          /10
        </span>
      </span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", fontSize: 13 }}
    >
      <span className="muted">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

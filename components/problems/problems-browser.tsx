"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Icon, Pill, toast } from "@/components/ui";
import { PATTERN_GROUPS } from "@/lib/patterns/groups";

export type ProblemRowStatus = "solved" | "attempted" | "todo";
export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export type ProblemRow = {
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  patternId: string;
  patternName: string;
  status: ProblemRowStatus;
  lastAttemptLabel: string;
};

type DiffFilter = "all" | ProblemDifficulty;
type StatusFilter = "all" | ProblemRowStatus;
type PatternFilter = "all" | string;

export type ProblemsBrowserProps = {
  rows: readonly ProblemRow[];
};

export function ProblemsBrowser({ rows }: ProblemsBrowserProps) {
  const [pattern, setPattern] = useState<PatternFilter>("all");
  const [diff, setDiff] = useState<DiffFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const byDiff: Record<ProblemDifficulty, number> = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
    };
    const byStatus: Record<ProblemRowStatus, number> = {
      solved: 0,
      attempted: 0,
      todo: 0,
    };
    const byPattern = new Map<string, number>();
    for (const r of rows) {
      byDiff[r.difficulty]++;
      byStatus[r.status]++;
      byPattern.set(r.patternId, (byPattern.get(r.patternId) ?? 0) + 1);
    }
    return { byDiff, byStatus, byPattern };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (p) =>
        (pattern === "all" || p.patternId === pattern) &&
        (diff === "all" || p.difficulty === diff) &&
        (status === "all" || p.status === status) &&
        (needle === "" || p.title.toLowerCase().includes(needle)),
    );
  }, [rows, pattern, diff, status, q]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <aside
        className="glass"
        style={{
          width: 240,
          flexShrink: 0,
          padding: 16,
          borderRadius: 0,
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems…"
          className="input"
          aria-label="Search problems"
        />
        <Facet
          label="Difficulty"
          value={diff}
          onChange={(v) => setDiff(v as DiffFilter)}
          options={[
            { id: "all", label: "All", count: rows.length },
            { id: "Easy", label: "Easy", count: counts.byDiff.Easy },
            { id: "Medium", label: "Medium", count: counts.byDiff.Medium },
            { id: "Hard", label: "Hard", count: counts.byDiff.Hard },
          ]}
        />
        <Facet
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { id: "all", label: "All" },
            { id: "solved", label: "Solved", count: counts.byStatus.solved },
            {
              id: "attempted",
              label: "Attempted",
              count: counts.byStatus.attempted,
            },
            { id: "todo", label: "Todo", count: counts.byStatus.todo },
          ]}
        />
        <Facet
          label="Pattern"
          value={pattern}
          onChange={(v) => setPattern(v as PatternFilter)}
          options={[
            { id: "all", label: "All patterns" },
            ...PATTERN_GROUPS.map((p) => ({
              id: p.id,
              label: p.name,
              count: counts.byPattern.get(p.id) ?? 0,
            })),
          ]}
        />
      </aside>

      <main style={{ flex: 1, overflow: "auto", padding: "20px 24px 32px" }}>
        <div
          className="row"
          style={{ marginBottom: 16, alignItems: "flex-end" }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-.015em",
            }}
          >
            Problems
          </h2>
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            <span className="mono">{filtered.length}</span> of {rows.length}
          </span>
          <div style={{ flex: 1 }} />
          <Button
            size="sm"
            icon="plus"
            onClick={() =>
              toast("Custom problems are coming soon", { kind: "info" })
            }
          >
            New custom problem
          </Button>
        </div>

        <div
          className="glass"
          style={{ borderRadius: 12, overflow: "hidden" }}
        >
          <div
            className="row mono"
            style={{
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-faint)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-2)",
              gap: 12,
            }}
          >
            <span style={{ width: 22 }} />
            <span style={{ flex: 1 }}>Problem</span>
            <span style={{ width: 160 }}>Pattern</span>
            <span style={{ width: 90 }}>Difficulty</span>
            <span style={{ width: 110, textAlign: "right" }}>Last attempt</span>
          </div>
          {filtered.map((p, i) => (
            <ProblemLink
              key={p.slug}
              row={p}
              isLast={i === filtered.length - 1}
            />
          ))}
          {filtered.length === 0 && (
            <div
              className="muted"
              style={{
                padding: "24px 16px",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No problems match these filters.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

type FacetOption = { id: string; label: string; count?: number };

function Facet({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: readonly FacetOption[];
}) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div className="col" style={{ gap: 1 }}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className="row"
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: 0,
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text)",
                fontSize: 12.5,
                gap: 6,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: active ? "var(--accent)" : "var(--bg-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {active && (
                  <Icon name="check" size={9} className="text-white" />
                )}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>{o.label}</span>
              {o.count != null && (
                <span className="mono muted" style={{ fontSize: 10.5 }}>
                  {o.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProblemLink({ row, isLast }: { row: ProblemRow; isLast: boolean }) {
  return (
    <Link
      href={`/problem/${row.slug}`}
      className="row"
      style={{
        padding: "11px 16px",
        borderBottom: isLast ? 0 : "1px solid var(--border)",
        textDecoration: "none",
        color: "var(--text)",
        fontSize: 13,
        gap: 12,
        transition: "background 120ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <StatusBadge status={row.status} />
      <span style={{ flex: 1, fontWeight: 500 }}>{row.title}</span>
      <span className="muted mono" style={{ width: 160, fontSize: 12 }}>
        {row.patternName}
      </span>
      <span style={{ width: 90 }}>
        <Pill
          kind={
            row.difficulty === "Easy"
              ? "easy"
              : row.difficulty === "Medium"
                ? "med"
                : "hard"
          }
        >
          {row.difficulty}
        </Pill>
      </span>
      <span
        className="mono muted"
        style={{ width: 110, textAlign: "right", fontSize: 11.5 }}
      >
        {row.lastAttemptLabel}
      </span>
    </Link>
  );
}

function StatusBadge({ status }: { status: ProblemRowStatus }) {
  const isSolved = status === "solved";
  const isAttempted = status === "attempted";
  return (
    <span
      aria-label={status}
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        background: isSolved
          ? "var(--accepted)"
          : isAttempted
            ? "var(--amber)"
            : "var(--bg-2)",
        border: status === "todo" ? "1px solid var(--border)" : 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {isSolved && (
        <Icon name="check" size={10} className="text-white" />
      )}
      {isAttempted && (
        <span
          style={{
            width: 4,
            height: 4,
            background: "white",
            borderRadius: "50%",
          }}
        />
      )}
    </span>
  );
}

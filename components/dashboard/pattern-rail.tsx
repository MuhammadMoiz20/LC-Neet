"use client";

import { Icon, Ring } from "@/components/ui";

export type PatternRailItem = {
  id: string;
  name: string;
  total: number;
  solved: number;
};

export type PatternRailProps = {
  patterns: PatternRailItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
};

export function PatternRail({ patterns, activeId, onSelect }: PatternRailProps) {
  const totalSolved = patterns.reduce((a, p) => a + p.solved, 0);
  const totalAll = patterns.reduce((a, p) => a + p.total, 0);
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        padding: 12,
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        background: "var(--surface-glass)",
      }}
    >
      <div
        className="row"
        style={{ padding: "4px 8px 10px", justifyContent: "space-between" }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            fontWeight: 600,
          }}
        >
          Patterns
        </span>
        <span className="mono muted" style={{ fontSize: 11 }}>
          {totalSolved}/{totalAll}
        </span>
      </div>
      <div className="col" style={{ gap: 1 }}>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="row"
          style={{
            padding: "7px 8px",
            borderRadius: 8,
            border: 0,
            background: !activeId ? "var(--accent-soft)" : "transparent",
            color: !activeId ? "var(--accent)" : "var(--text)",
            cursor: "pointer",
            fontSize: 13,
            gap: 8,
          }}
        >
          <Icon name="target" size={14} /> All patterns
        </button>
        {patterns.map((p) => {
          const active = activeId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="row"
              style={{
                padding: "7px 8px",
                borderRadius: 8,
                border: 0,
                background: active ? "var(--accent-soft)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 13,
                gap: 8,
              }}
            >
              <Ring
                size={20}
                stroke={2.5}
                value={p.solved}
                max={p.total}
                color={active ? "var(--accent)" : "var(--text-muted)"}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  color: active ? "var(--accent)" : "var(--text)",
                }}
              >
                {p.name}
              </span>
              <span
                className="mono"
                style={{ fontSize: 10.5, color: "var(--text-faint)" }}
              >
                {p.solved}/{p.total}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

"use client";

import type { HeatmapDay } from "@/lib/stats/heatmap";

export type HeatmapProps = {
  days: HeatmapDay[];
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_MS = 86_400_000;

function buildMonthLabels(weeks: number): { label: string; col: number }[] {
  // Compute the calendar month at the start of each week column,
  // so we can place a label only when the month flips.
  const labels: { label: string; col: number }[] = [];
  const today = new Date();
  // Start date = today - (weeks*7 - 1) days
  const startMs = today.getTime() - (weeks * 7 - 1) * DAY_MS;
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const colStart = new Date(startMs + w * 7 * DAY_MS);
    const m = colStart.getMonth();
    if (m !== lastMonth) {
      labels.push({ label: MONTH_NAMES[m] ?? "", col: w });
      lastMonth = m;
    }
  }
  return labels;
}

export function Heatmap({ days }: HeatmapProps) {
  const weeks = Math.ceil(days.length / 7);
  const cols: HeatmapDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = days[w * 7 + d];
      if (day) col.push(day);
    }
    cols.push(col);
  }
  const total = days.reduce((a, d) => a + d.count, 0);
  const monthLabels = buildMonthLabels(weeks);

  return (
    <div className="glass" style={{ padding: 18, borderRadius: 12 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="col">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Activity
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-.01em",
            }}
          >
            <span className="mono">{total}</span> attempts in the last 26 weeks
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          className="row mono"
          style={{ gap: 6, fontSize: 11, color: "var(--text-muted)" }}
        >
          Less
          <span className="hm-cell" />
          <span className="hm-cell hm-1" />
          <span className="hm-cell hm-2" />
          <span className="hm-cell hm-3" />
          <span className="hm-cell hm-4" />
          More
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div
          className="row mono"
          style={{
            fontSize: 10.5,
            color: "var(--text-faint)",
            marginBottom: 4,
            paddingLeft: 22,
            position: "relative",
            height: 14,
          }}
        >
          {monthLabels.map((m, i) => (
            <span
              key={`${m.label}-${i}`}
              style={{
                position: "absolute",
                left: 22 + m.col * (12 + 2),
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <div
            className="col mono"
            style={{
              fontSize: 10.5,
              color: "var(--text-faint)",
              justifyContent: "space-between",
              height: 7 * 14 + 6 * 2,
              paddingTop: 14,
            }}
          >
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div className="row" style={{ gap: 2 }}>
            {cols.map((col, w) => (
              <div className="col" key={w} style={{ gap: 2 }}>
                {col.map((d, di) => (
                  <span
                    key={di}
                    title={`${d.count} attempts`}
                    className={`hm-cell ${d.level ? "hm-" + d.level : ""}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

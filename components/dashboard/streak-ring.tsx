"use client";

import { Icon } from "@/components/ui";

export type StreakRingProps = {
  current: number;
  best: number;
  today: boolean;
};

export function StreakRing({ current, best, today }: StreakRingProps) {
  const ringSize = 96;
  return (
    <div className="glass" style={{ padding: 18, borderRadius: 12 }}>
      <div className="row" style={{ gap: 14 }}>
        <div
          style={{ position: "relative", width: ringSize, height: ringSize }}
        >
          <div
            className="shimmer-ring"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              padding: 3,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "var(--surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: "var(--accent)",
                }}
              >
                {current}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                days
              </span>
            </div>
          </div>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <span
            className="row"
            style={{ gap: 6, fontWeight: 600, fontSize: 14 }}
          >
            <Icon name="flame" size={14} className="" /> Streak
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            Best:{" "}
            <span className="mono" style={{ color: "var(--text)" }}>
              {best}
            </span>
          </span>
          <span
            className="row"
            style={{
              gap: 4,
              fontSize: 11.5,
              color: today ? "var(--accepted)" : "var(--amber)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: today ? "var(--accepted)" : "var(--amber)",
              }}
            />
            {today ? "Counted today" : "Solve one to keep it"}
          </span>
        </div>
      </div>
    </div>
  );
}

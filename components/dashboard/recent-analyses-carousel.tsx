"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon, IconButton, Pill, Sparkline } from "@/components/ui";

export type RecentAnalysisItem = {
  id: number;
  slug: string;
  name: string;
  verdict: "Accepted" | "Wrong" | "TLE" | string;
  runtimeMs: number | null;
  whenAgo: string;
  takeaway: string;
};

export type RecentAnalysesCarouselProps = {
  items: RecentAnalysisItem[];
};

function makeSpark(seedNum: number, runtime: number | null): number[] {
  const base = runtime != null && runtime > 0 ? Math.min(80, runtime / 4) : 30;
  return Array.from({ length: 12 }, (_, i) =>
    base + Math.sin(i * 1.3 + seedNum * 0.7) * 18 + i * 2,
  );
}

function verdictPill(verdict: string) {
  if (verdict === "Accepted") {
    return (
      <Pill kind="easy">
        <Icon name="check" size={10} /> Accepted
      </Pill>
    );
  }
  if (verdict === "Wrong") {
    return (
      <Pill kind="hard">
        <Icon name="x" size={10} /> Wrong
      </Pill>
    );
  }
  return (
    <Pill kind="med">
      <Icon name="clock" size={10} /> {verdict}
    </Pill>
  );
}

export function RecentAnalysesCarousel({
  items,
}: RecentAnalysesCarouselProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scroll = (dir: number): void => {
    ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (items.length === 0) {
    return (
      <div className="col" style={{ gap: 10 }}>
        <div className="row">
          <span style={{ fontSize: 14, fontWeight: 600 }}>Recent analyses</span>
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            past few days
          </span>
        </div>
        <div
          className="glass"
          style={{
            padding: 24,
            borderRadius: 12,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          No attempts yet. Start a problem to see analyses here.
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row">
        <span style={{ fontSize: 14, fontWeight: 600 }}>Recent analyses</span>
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
          past few days
        </span>
        <div style={{ flex: 1 }} />
        <IconButton
          icon="chevron-l"
          onClick={() => scroll(-1)}
          sm
          title="Scroll left"
        />
        <IconButton
          icon="chevron-r"
          onClick={() => scroll(1)}
          sm
          title="Scroll right"
        />
      </div>
      <div
        ref={ref}
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
        }}
      >
        {items.map((a) => {
          const spark = makeSpark(a.id, a.runtimeMs);
          return (
            <Link
              key={a.id}
              href={`/analysis/${a.id}`}
              className="glass"
              style={{
                flex: "0 0 300px",
                padding: 16,
                borderRadius: 12,
                textDecoration: "none",
                color: "var(--text)",
                scrollSnapAlign: "start",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "transform 150ms, border-color 150ms",
              }}
            >
              <div className="row" style={{ gap: 8 }}>
                {verdictPill(a.verdict)}
                <span
                  className="mono muted"
                  style={{ fontSize: 11, marginLeft: "auto" }}
                >
                  {a.whenAgo}
                </span>
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "-.005em",
                }}
              >
                {a.name}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <Sparkline values={spark} width={100} height={22} />
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {a.runtimeMs != null ? `${a.runtimeMs}ms` : "no metrics"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: "var(--accent)" }}>Coach · </span>
                {a.takeaway}
              </div>
              <div
                className="row"
                style={{
                  marginTop: "auto",
                  justifyContent: "space-between",
                  paddingTop: 4,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-faint)" }}
                >
                  a-{a.id}
                </span>
                <span
                  className="row"
                  style={{ gap: 4, fontSize: 12, color: "var(--accent)" }}
                >
                  Open <Icon name="arrow-r" size={12} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, IconButton, Pill } from "@/components/ui";
import { PatternRail, type PatternRailItem } from "./pattern-rail";
import { DoNextHero, type DoNextHeroProps } from "./do-next-hero";
import { Heatmap } from "./heatmap";
import {
  RecentAnalysesCarousel,
  type RecentAnalysisItem,
} from "./recent-analyses-carousel";
import { StreakRing } from "./streak-ring";
import {
  WeakPatternCallouts,
  type WeakPatternItem,
} from "./weak-pattern-callouts";
import { ResumeCard, type ResumeCardProps } from "./resume-card";
import type { HeatmapDay } from "@/lib/stats/heatmap";

export type DashboardViewProps = {
  greetingName: string;
  greetingTime: string; // "morning" | "afternoon" | "evening"
  totalSolved: number;
  totalProblems: number;
  patterns: PatternRailItem[];
  doNext: DoNextHeroProps;
  heatmap: HeatmapDay[];
  recent: RecentAnalysisItem[];
  streak: { current: number; best: number; today: boolean };
  resume: ResumeCardProps;
  weak: WeakPatternItem[];
};

export function DashboardView(props: DashboardViewProps) {
  const router = useRouter();
  const [rightOpen, setRightOpen] = useState(true);

  const overallPct = props.totalProblems
    ? Math.round((props.totalSolved / props.totalProblems) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
      <PatternRail
        patterns={props.patterns}
        activeId={null}
        onSelect={(id) =>
          router.push(id ? `/problems?pattern=${id}` : "/problems")
        }
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          padding: "24px 28px 40px",
        }}
      >
        <div
          className="col"
          style={{ gap: 22, maxWidth: 1100 }}
        >
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="col">
              <span className="muted" style={{ fontSize: 13 }}>
                Good {props.greetingTime}, {props.greetingName}
              </span>
              <h2
                style={{
                  margin: "2px 0 0",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-.015em",
                }}
              >
                Let&apos;s keep the streak alive.
              </h2>
            </div>
            <div style={{ flex: 1 }} />
            <div className="row" style={{ gap: 6 }}>
              <Pill>
                <Icon
                  name="check"
                  size={11}
                  className=""
                />{" "}
                {props.totalSolved} / {props.totalProblems} solved
              </Pill>
              <Pill kind="info">~{overallPct}%</Pill>
            </div>
          </div>

          <DoNextHero {...props.doNext} />
          <Heatmap days={props.heatmap} />
          <RecentAnalysesCarousel items={props.recent} />
        </div>
      </main>
      {rightOpen && (
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            padding: 16,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "var(--surface-glass)",
          }}
        >
          <div className="row">
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              Today
            </span>
            <div style={{ flex: 1 }} />
            <IconButton
              icon="panel-r"
              sm
              title="Hide rail"
              onClick={() => setRightOpen(false)}
            />
          </div>
          <StreakRing
            current={props.streak.current}
            best={props.streak.best}
            today={props.streak.today}
          />
          <ResumeCard {...props.resume} />
          <WeakPatternCallouts items={props.weak} />
        </aside>
      )}
      {!rightOpen && (
        <button
          type="button"
          onClick={() => setRightOpen(true)}
          className="btn btn-ghost btn-icon"
          style={{ position: "absolute", right: 8, top: 8 }}
          title="Show rail"
          aria-label="Show rail"
        >
          <Icon name="panel-l" size={14} />
        </button>
      )}
    </div>
  );
}

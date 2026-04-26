"use client";

import Link from "next/link";
import { Button, Icon, Kbd, Pill, toast } from "@/components/ui";

export type DoNextHeroProps = {
  slug: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  patternName: string;
  spaced: string;
  est: string;
  why: string;
  lastAttempt?: { whenAgo: string; verdict: string };
  accuracy?: number;
  queueLabel?: string;
};

export function DoNextHero({
  slug,
  name,
  difficulty,
  patternName,
  spaced,
  est,
  why,
  lastAttempt,
  accuracy,
  queueLabel,
}: DoNextHeroProps) {
  const diffKind =
    difficulty === "Easy" ? "easy" : difficulty === "Medium" ? "med" : "hard";
  return (
    <div
      className="glass"
      style={{
        padding: 24,
        borderRadius: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -120,
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, var(--accent-soft), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        className="row"
        style={{ gap: 8, marginBottom: 14, position: "relative" }}
      >
        <Pill kind="accent">
          <Icon name="target" size={11} /> Do next
        </Pill>
        <Pill kind="info">{spaced}</Pill>
        <span className="muted mono" style={{ fontSize: 11 }}>
          est. {est}
        </span>
        <div style={{ flex: 1 }} />
        {queueLabel && (
          <span className="muted mono" style={{ fontSize: 11 }}>
            {queueLabel}
          </span>
        )}
      </div>
      <div
        className="row"
        style={{ alignItems: "flex-end", gap: 24, position: "relative" }}
      >
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {patternName}
            </span>
            <span className="muted">›</span>
            <Pill kind={diffKind}>{difficulty}</Pill>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-.02em",
              lineHeight: 1.05,
            }}
          >
            {name}
          </h1>
          <p
            style={{
              marginTop: 12,
              maxWidth: 540,
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            <span
              className="row"
              style={{
                gap: 6,
                color: "var(--accent)",
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <Icon name="sparkle" size={12} /> Why this
            </span>
            {why}
          </p>
          <div className="row" style={{ marginTop: 18, gap: 8 }}>
            <Link href={`/problem/${slug}`} style={{ textDecoration: "none" }}>
              <Button kind="primary" size="lg" icon="play">
                Start <Kbd>↵</Kbd>
              </Button>
            </Link>
            <Button
              size="lg"
              icon="reset"
              onClick={() => toast("Skipped — picking another", { kind: "info" })}
            >
              Skip
            </Button>
            <Button
              kind="ghost"
              size="lg"
              onClick={() => toast(why, { kind: "info", duration: 4000 })}
            >
              Why this?
            </Button>
          </div>
        </div>
        <div className="col" style={{ gap: 10, paddingBottom: 4 }}>
          {lastAttempt && (
            <div
              className="glass row"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                gap: 10,
                background: "var(--surface)",
              }}
            >
              <Icon name="history" size={14} className="muted" />
              <div className="col">
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Last attempt
                </span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {lastAttempt.whenAgo} ·{" "}
                  <span
                    style={{
                      color:
                        lastAttempt.verdict.toLowerCase() === "passed" ||
                        lastAttempt.verdict.toLowerCase() === "accepted"
                          ? "var(--accepted)"
                          : "var(--rose)",
                    }}
                  >
                    {lastAttempt.verdict}
                  </span>
                </span>
              </div>
            </div>
          )}
          {typeof accuracy === "number" && (
            <div
              className="glass row"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                gap: 10,
                background: "var(--surface)",
              }}
            >
              <Icon name="trend" size={14} className="muted" />
              <div className="col">
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Pattern accuracy
                </span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {Math.round(accuracy * 100)}%{" "}
                  <span className="muted">· last 30d</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

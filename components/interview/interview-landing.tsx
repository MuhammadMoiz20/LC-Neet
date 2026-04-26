"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Pill } from "@/components/ui";
import type { PatternGroup } from "@/lib/patterns/groups";
import { startInterview } from "@/app/(app)/interview/start";

export type LastRoundSummary = {
  slug: string;
  title: string;
  status: "passed" | "failed" | "error";
  createdAt: number;
};

export type InterviewLandingProps = {
  patterns: readonly PatternGroup[];
  lastRound: LastRoundSummary | null;
};

type Difficulty = "Easy" | "Medium" | "Hard" | "Mixed";

const DURATIONS: readonly number[] = [30, 45, 60, 90];
const DIFFICULTIES: readonly Difficulty[] = ["Easy", "Medium", "Hard", "Mixed"];

function formatRelative(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - seconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function InterviewLanding({ patterns, lastRound }: InterviewLandingProps) {
  const router = useRouter();
  const [duration, setDuration] = useState<number>(45);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [topic, setTopic] = useState<string>("mixed");
  const [pending, startTransition] = useTransition();

  function onStart() {
    const fd = new FormData();
    fd.set("duration", String(duration));
    fd.set("difficulty", difficulty);
    fd.set("topic", topic);
    startTransition(() => {
      void startInterview(fd);
    });
  }

  const lastStatusColor =
    lastRound?.status === "passed"
      ? "var(--accepted)"
      : lastRound
        ? "var(--rose)"
        : "var(--text-muted)";
  const lastStatusLabel =
    lastRound?.status === "passed"
      ? "Accepted"
      : lastRound?.status === "failed"
        ? "Failed"
        : lastRound?.status === "error"
          ? "Error"
          : "";

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "40px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="glass" style={{ width: 580, padding: 32, borderRadius: 20 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <Pill kind="accent">
            <Icon name="briefcase" size={11} /> Interview mode
          </Pill>
          <Pill>
            <Icon name="lock" size={10} /> coach locked
          </Pill>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-.015em",
          }}
        >
          Simulated round
        </h1>
        <p
          style={{
            margin: "10px 0 22px",
            color: "var(--text-muted)",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: 460,
            textWrap: "pretty",
          }}
        >
          A timer, hidden test results, and a coach who only answers clarifying
          questions. You unlock everything when the timer ends.
        </p>

        <div className="col" style={{ gap: 16, marginBottom: 22 }}>
          <div className="col" style={{ gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              Duration
            </span>
            <div className="row" style={{ gap: 6 }}>
              {DURATIONS.map((d) => {
                const active = duration === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="btn btn-sm"
                    style={{
                      background: active ? "var(--accent)" : "var(--surface)",
                      color: active ? "white" : "var(--text)",
                      borderColor: active ? "transparent" : "var(--border)",
                    }}
                  >
                    {d} min
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              Difficulty
            </span>
            <div className="row" style={{ gap: 6 }}>
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className="btn btn-sm"
                    style={{
                      background: active ? "var(--accent-soft)" : "var(--surface)",
                      color: active ? "var(--accent)" : "var(--text)",
                      borderColor: active ? "var(--accent-ring)" : "var(--border)",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              Topic
            </span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="input"
              style={{ width: "100%" }}
            >
              <option value="mixed">Mixed (recommended)</option>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <Button
            kind="primary"
            size="lg"
            icon="play"
            onClick={onStart}
            disabled={pending}
          >
            {pending ? "Starting…" : "Start round"}
          </Button>
          <Button
            kind="ghost"
            size="lg"
            onClick={() => router.push("/")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>

        {lastRound && (
          <div className="muted" style={{ fontSize: 12, marginTop: 18 }}>
            <span className="row" style={{ gap: 6 }}>
              <Icon name="clock" size={12} />
              Last round:{" "}
              <span className="mono" style={{ color: "var(--text)" }}>
                {formatRelative(lastRound.createdAt)}
              </span>{" "}
              · {lastRound.title} ·{" "}
              <span style={{ color: lastStatusColor }}>{lastStatusLabel}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

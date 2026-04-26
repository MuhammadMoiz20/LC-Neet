"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Pill } from "@/components/ui";
import type { Attempt } from "@/lib/attempts/repo";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function statusKind(s: Attempt["status"]) {
  if (s === "passed") return "easy" as const;
  if (s === "failed") return "hard" as const;
  return "med" as const;
}

function statusLabel(s: Attempt["status"]) {
  return s === "passed" ? "Accepted" : s === "failed" ? "Wrong" : "Error";
}

export type SubmissionsTabProps = {
  fetchAttempts: () => Promise<Attempt[]>;
  refreshKey: number;
  onRestore: (code: string) => void;
};

export function SubmissionsTab({
  fetchAttempts,
  refreshKey,
  onRestore,
}: SubmissionsTabProps) {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAttempts()
      .then((rows) => {
        if (cancelled) return;
        setAttempts(rows);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAttempts, refreshKey]);

  if (error) {
    return (
      <div style={{ padding: 28, color: "var(--text-muted)" }}>
        Couldn&apos;t load submissions: {error}
      </div>
    );
  }
  if (attempts === null) {
    return (
      <div style={{ padding: 28, color: "var(--text-faint)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (attempts.length === 0) {
    return (
      <div
        className="col"
        style={{
          padding: 28,
          color: "var(--text-muted)",
          gap: 6,
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text)" }}>
          No submissions yet
        </span>
        <span>Run or submit your code and it&apos;ll show up here.</span>
      </div>
    );
  }

  return (
    <div
      className="col"
      style={{ height: "100%", overflow: "hidden", minHeight: 0 }}
    >
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          overflowY: "auto",
          flexShrink: 0,
          maxHeight: openId === null ? "100%" : 220,
          borderBottom:
            openId === null ? "none" : "1px solid var(--border)",
        }}
      >
        {attempts.map((a) => {
          const isOpen = openId === a.id;
          return (
            <li
              key={a.id}
              style={{
                borderBottom: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="row"
                style={{
                  width: "100%",
                  padding: "10px 28px",
                  border: 0,
                  background: isOpen ? "var(--bg-2)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                  gap: 12,
                  textAlign: "left",
                }}
              >
                <Pill kind={statusKind(a.status)}>{statusLabel(a.status)}</Pill>
                <span className="mono" style={{ color: "var(--text-muted)" }}>
                  {a.runtime_ms != null ? `${a.runtime_ms}ms` : "—"}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{a.mode}</span>
                <div style={{ flex: 1 }} />
                <span
                  className="mono"
                  style={{ color: "var(--text-faint)", fontSize: 11 }}
                >
                  {timeAgo(a.created_at * 1000)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {openId !== null && (() => {
        const a = attempts.find((x) => x.id === openId);
        if (!a) return null;
        return (
          <div
            className="col"
            style={{ flex: 1, minHeight: 0, background: "var(--surface)" }}
          >
            <div
              className="row"
              style={{
                padding: "8px 28px",
                gap: 10,
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <span>Submission #{a.id}</span>
              <span style={{ color: "var(--text-faint)" }}>·</span>
              <span>{new Date(a.created_at * 1000).toLocaleString()}</span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onRestore(a.code)}
                style={{ fontSize: 12 }}
              >
                Restore to editor
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Monaco
                height="100%"
                defaultLanguage="python"
                value={a.code}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import type { Analysis } from "./repo";

/**
 * One attempt's analysis as the client sees it.
 *
 *   loading ──► running ──► settled
 *                 │  ▲         │
 *                 ▼  └─────────┤  rerun()
 *              stalled ────────┘
 *
 * loading  — nothing fetched yet
 * running  — rows are pending (or not created yet); polling
 * settled  — every row is done or error; polling stopped
 * stalled  — still pending after the server's time budget; polling stopped
 */
export type AnalysisPhase = "loading" | "running" | "settled" | "stalled";

const POLL_MS = 2000;
// The pipeline's serverless budget is 300s (maxDuration in the API route).
// Rows still pending after that will never finish on their own.
const MAX_POLLS = 150;

export function analysisPhase(
  rows: Pick<Analysis, "status">[] | null,
  polls: number,
): AnalysisPhase {
  if (rows === null) return "loading";
  if (rows.length > 0 && rows.every((r) => r.status !== "pending")) return "settled";
  return polls >= MAX_POLLS ? "stalled" : "running";
}

async function request(
  attemptId: number,
  method: "GET" | "POST",
  force = false,
): Promise<Analysis[] | null> {
  try {
    const res = await fetch(
      `/api/analysis/${attemptId}${force ? "?force=1" : ""}`,
      { method, cache: "no-store" },
    );
    if (!res.ok) return null;
    return ((await res.json()) as { rows: Analysis[] }).rows;
  } catch {
    return null;
  }
}

export function useAnalysis(attemptId: number, initial?: Analysis[]) {
  const [rows, setRows] = useState<Analysis[] | null>(initial ?? null);
  const [polls, setPolls] = useState(0);

  const phase = analysisPhase(rows, polls);

  // Load, and start the pipeline for an attempt that was never analysed
  // (failed and interview submissions don't start one on their own).
  const initialSettled =
    (initial?.length ?? 0) > 0 && initial!.every((r) => r.status !== "pending");
  const needsFetch = initial === undefined;
  useEffect(() => {
    if (initialSettled) return;
    let cancelled = false;
    (async () => {
      let next = needsFetch ? await request(attemptId, "GET") : null;
      // Starting is idempotent on the server: a no-op for a live run, a restart
      // for one that died and left its rows pending.
      if (!next?.length || next.some((r) => r.status === "pending")) {
        next = (await request(attemptId, "POST")) ?? next;
      }
      // A failed request becomes "no rows yet" so polling takes over.
      if (!cancelled) setRows((prev) => next ?? prev ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, initialSettled, needsFetch]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(async () => {
      const next = await request(attemptId, "GET");
      setPolls((n) => n + 1);
      if (next) setRows(next);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [attemptId, phase]);

  const rerun = useCallback(async () => {
    setPolls(0);
    setRows((prev) =>
      (prev ?? []).map((r) => ({ ...r, status: "pending" as const, content_md: "" })),
    );
    const next = await request(attemptId, "POST", true);
    if (next) setRows(next);
  }, [attemptId]);

  return { rows: rows ?? [], phase, rerun };
}

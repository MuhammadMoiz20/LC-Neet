"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Analysis, AnalysisKind } from "@/lib/analysis/repo";

const KIND_LABELS: Record<AnalysisKind, string> = {
  quality: "Code Quality",
  complexity: "Complexity",
  comparison: "Comparison to Optimal",
  pattern: "Pattern",
  mistake: "Mistake Detection",
  interview_debrief: "Interview Debrief",
};
const KIND_ORDER: AnalysisKind[] = [
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
  "interview_debrief",
];

export function AnalysisView({
  attemptId,
  initial,
}: { attemptId: number; initial: Analysis[] }) {
  const [rows, setRows] = useState<Analysis[]>(initial);

  const expectedCount = rows.some((r) => r.kind === "interview_debrief")
    ? KIND_ORDER.length
    : KIND_ORDER.length - 1;
  const incomplete =
    rows.length < expectedCount || rows.some((r) => r.status === "pending");

  useEffect(() => {
    if (!incomplete) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${attemptId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: Analysis[] };
        setRows(data.rows);
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [attemptId, incomplete]);

  const byKind = new Map(rows.map((r) => [r.kind, r] as const));

  return (
    <div className="space-y-6">
      {KIND_ORDER.map((kind) => {
        if (kind === "interview_debrief" && !byKind.has("interview_debrief")) {
          return null;
        }
        const row = byKind.get(kind);
        const status = row?.status ?? "pending";
        return (
          <section key={kind} className="border border-zinc-800 rounded p-4">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{KIND_LABELS[kind]}</h2>
              <StatusPill status={status} />
            </header>
            {status === "pending" ? (
              <p className="text-sm text-zinc-500 italic">Analysis in progress…</p>
            ) : (
              <div className="text-sm space-y-2">
                <ReactMarkdown>{row?.content_md ?? ""}</ReactMarkdown>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "done" ? "bg-emerald-900/40 text-emerald-300"
    : status === "error" ? "bg-red-900/40 text-red-300"
    : "bg-zinc-800 text-zinc-300 animate-pulse";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{status}</span>
  );
}

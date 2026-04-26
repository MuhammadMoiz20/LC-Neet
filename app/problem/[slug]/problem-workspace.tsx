"use client";
import { useState } from "react";
import type { Problem } from "@/lib/problems/types";
import { CodeEditor } from "@/components/code-editor";
import { usePyodideRunner } from "@/lib/pyodide/use-pyodide-runner";
import type { RunResult } from "@/lib/pyodide/worker-protocol";
import { submitAttempt } from "./actions";
import { CoachPanel } from "@/components/coach-panel";

export function ProblemWorkspace({ problem }: { problem: Problem }) {
  const [code, setCode] = useState(problem.starter_code);
  const [result, setResult] = useState<RunResult | null>(null);
  const { status, run, errorMsg } = usePyodideRunner();
  const [coachOpen, setCoachOpen] = useState(false);
  const lastRunOutput = result
    ? result.compile_error ??
      result.results
        .map((c, i) => `Case ${i + 1}: ${c.passed ? "PASS" : "FAIL"} ${c.error ?? ""}`)
        .join("\n")
    : null;

  async function onRun() {
    const r = await run(
      code,
      JSON.stringify(problem.test_cases),
      problem.method_name,
    );
    setResult(r);
    const allPassed = r.compile_error === null && r.results.every((c) => c.passed);
    const totalMs = r.results.reduce((s, c) => s + c.elapsed_ms, 0);
    await submitAttempt({
      problemId: problem.id,
      code,
      status: r.compile_error
        ? "error"
        : allPassed
          ? "passed"
          : "failed",
      runtimeMs: totalMs,
      mode: "run",
    });
  }

  return (
    <main className="grid grid-cols-2 gap-4 h-screen p-4">
      <section className="overflow-auto pr-4 border-r border-zinc-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-2xl font-semibold">
            {problem.id}. {problem.title}
          </h1>
          <button
            onClick={() => setCoachOpen((v) => !v)}
            className="text-sm px-3 py-1 rounded border border-zinc-800 hover:bg-zinc-900 shrink-0"
          >
            {coachOpen ? "Hide coach" : "Coach"}
          </button>
        </div>
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-4">
          {problem.difficulty} · {problem.topic}
        </p>
        <article className="prose prose-invert max-w-none whitespace-pre-wrap">
          {problem.description_md}
        </article>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex-1 border border-zinc-800 rounded overflow-hidden">
          <CodeEditor value={code} onChange={setCode} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={status !== "ready" && status !== "running"}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {status === "loading"
              ? "Loading Python…"
              : status === "running"
                ? "Running…"
                : "Run tests"}
          </button>
          {errorMsg && <span className="text-red-500 text-sm">{errorMsg}</span>}
        </div>
        <ResultsPanel result={result} />
      </section>
      <CoachPanel
        problemId={problem.id}
        code={code}
        lastRunOutput={lastRunOutput}
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
      />
    </main>
  );
}

function ResultsPanel({ result }: { result: RunResult | null }) {
  if (!result) return null;
  if (result.compile_error) {
    return (
      <pre className="bg-red-950/40 border border-red-900 p-2 rounded text-sm overflow-auto max-h-64">
        {result.compile_error}
      </pre>
    );
  }
  return (
    <div className="space-y-1 max-h-64 overflow-auto">
      {result.results.map((c, i) => (
        <div
          key={i}
          className={`p-2 rounded text-sm border ${
            c.passed
              ? "border-emerald-900 bg-emerald-950/30"
              : "border-red-900 bg-red-950/30"
          }`}
        >
          <div className="flex justify-between">
            <span>Case {i + 1}: {c.passed ? "PASS" : "FAIL"}</span>
            <span className="text-zinc-500">{c.elapsed_ms} ms</span>
          </div>
          {!c.passed && (
            <pre className="mt-1 text-xs whitespace-pre-wrap">
              expected: {JSON.stringify(c.expected)}
              {"\n"}actual: {JSON.stringify(c.actual)}
              {c.error ? "\n" + c.error : ""}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

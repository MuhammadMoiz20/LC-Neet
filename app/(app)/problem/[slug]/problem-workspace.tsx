"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Problem } from "@/lib/problems/types";
import { CodeEditor } from "@/components/code-editor";
import { usePyodideRunner } from "@/lib/pyodide/use-pyodide-runner";
import type { RunResult } from "@/lib/pyodide/worker-protocol";
import { submitAttempt, getMyAttempts } from "./actions";
import { SubmissionsTab } from "@/components/workspace/submissions-tab";
import { CoachPanel } from "@/components/coach-panel";
import { Icon, IconButton, toast } from "@/components/ui";
import { PromptRail } from "@/components/workspace/prompt-rail";
import {
  WorkspaceTabs,
  type WorkspaceTabId,
} from "@/components/workspace/workspace-tabs";
import {
  EditorToolbar,
  type EditorLang,
} from "@/components/workspace/editor-toolbar";
import {
  RunPanel,
  buildOutputLines,
  type Verdict,
} from "@/components/workspace/run-panel";
import { AnalysisPanel } from "@/components/workspace/analysis-panel";

function formatMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  // Monaco's editable area
  if (t.closest(".monaco-editor")) return true;
  return false;
}

function verdictFromResult(r: RunResult | null): Verdict {
  if (!r) return null;
  if (r.compile_error) return "Error";
  return r.results.every((c) => c.passed) ? "Accepted" : "Wrong";
}

export function ProblemWorkspace({
  problem,
  interviewMode = false,
  interviewDurationMin = 30,
}: {
  problem: Problem;
  interviewMode?: boolean;
  interviewDurationMin?: number;
}) {
  const [code, setCode] = useState(problem.starter_code);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<WorkspaceTabId>("sol");
  const [lang, setLang] = useState<EditorLang>("Python 3");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [analysisAttemptId, setAnalysisAttemptId] = useState<number | null>(
    null,
  );
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [submissionsRefreshKey, setSubmissionsRefreshKey] = useState(0);
  const { status: pyStatus, run, cancel, errorMsg } = usePyodideRunner();

  // Interview timer (preserved)
  const [endsAt] = useState(() =>
    interviewMode ? Date.now() + interviewDurationMin * 60_000 : 0,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    interviewMode ? interviewDurationMin * 60_000 : 0,
  );
  const [ended, setEnded] = useState(false);
  const autoSubmittedRef = useRef(false);
  const expired = interviewMode && remainingMs <= 0;

  useEffect(() => {
    if (!interviewMode) return;
    if (expired) return;
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [interviewMode, expired, endsAt]);

  const lastRunOutput = result
    ? result.compile_error ??
      result.results
        .map(
          (c, i) =>
            `Case ${i + 1}: ${c.passed ? "PASS" : "FAIL"} ${c.error ?? ""}`,
        )
        .join("\n")
    : null;

  const verdict = verdictFromResult(result);
  const totalRuntimeMs = result
    ? result.results.reduce((s, c) => s + c.elapsed_ms, 0)
    : null;
  const outputLines = buildOutputLines(result, interviewMode);

  const performRun = useCallback(
    async (mode: "run" | "submit") => {
      if (running) return;
      if (pyStatus !== "ready" && pyStatus !== "running") return;
      setRunning(true);
      try {
        const r = await run(
          code,
          JSON.stringify(problem.test_cases),
          problem.method_name,
        );
        setResult(r);
        // Don't record an attempt when the code didn't even run (syntax/import
        // errors before any test executed) — those aren't a real fail.
        if (r.compile_error) {
          return;
        }
        // Run is local-only: execute tests in Pyodide, show the verdict,
        // but don't persist an attempt or kick off analysis. Submissions
        // (and every action in interview mode, since interviews record the
        // full transcript) still go through the persisted path below.
        if (mode === "run" && !interviewMode) {
          return;
        }
        const allPassed = r.results.every((c) => c.passed);
        const totalMs = r.results.reduce((s, c) => s + c.elapsed_ms, 0);
        const attemptId = await submitAttempt({
          problemId: problem.id,
          code,
          status: allPassed ? "passed" : "failed",
          runtimeMs: totalMs,
          mode: interviewMode ? "interview" : mode,
        });
        setSubmissionsRefreshKey((k) => k + 1);
        if (allPassed && !interviewMode) {
          fetch(`/api/analysis/${attemptId}`, { method: "POST" }).catch(
            () => {},
          );
          setAnalysisAttemptId(attemptId);
          setSubmitted(true);
          toast("Submission accepted — analysis ready", { kind: "success" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "run failed";
        if (msg === "cancelled") {
          toast("Execution stopped", { kind: "info" });
        } else {
          toast(msg, { kind: "error" });
        }
      } finally {
        setRunning(false);
      }
    },
    [
      code,
      problem.test_cases,
      problem.method_name,
      problem.id,
      run,
      interviewMode,
      pyStatus,
      running,
    ],
  );

  // Auto-submit on timer expiry (preserve previous behavior)
  useEffect(() => {
    if (!interviewMode) return;
    if (!expired) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    setEnded(true);
    performRun("submit").catch(() => {});
  }, [interviewMode, expired, performRun]);

  // Workspace-scoped keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        performRun("run");
      } else if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        performRun("submit");
      } else if (k === "b") {
        if (interviewMode) return;
        e.preventDefault();
        setPromptCollapsed((c) => !c);
      } else if (k === "j") {
        e.preventDefault();
        setCoachOpen((o) => !o);
      } else if (k === "i") {
        if (!analysisAttemptId) return;
        e.preventDefault();
        setAnalysisOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performRun, analysisAttemptId, interviewMode]);

  const pythonReady = pyStatus === "ready" || pyStatus === "running";
  const analysisReady = analysisAttemptId != null && submitted;

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        height: "calc(100vh - 56px)",
        position: "relative",
      }}
    >
      {!interviewMode && (
        <PromptRail
          problem={problem}
          collapsed={promptCollapsed}
          onToggle={() => setPromptCollapsed((c) => !c)}
        />
      )}
      <div
        className="col"
        style={{ flex: 1, minWidth: 0, height: "100%" }}
      >
        <WorkspaceTabs tab={tab} onTab={setTab} />
        <EditorToolbar
          onRun={() => performRun("run")}
          onStop={() => cancel()}
          onSubmit={() => performRun("submit")}
          onReset={() => setCode(problem.starter_code)}
          running={running}
          pythonReady={pythonReady}
          hasAnalysis={analysisReady}
          analysisOpen={analysisOpen}
          onOpenAnalysis={() => setAnalysisOpen((o) => !o)}
          lang={lang}
          setLang={setLang}
          hideSubmitInIv={false}
        />
        <div
          className="col"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {tab === "sol" && (
              <div style={{ position: "absolute", inset: 0 }}>
                <CodeEditor value={code} onChange={setCode} />
              </div>
            )}
            {tab === "tests" && (
              <pre
                className="mono"
                style={{
                  margin: 0,
                  height: "100%",
                  overflow: "auto",
                  padding: "14px 28px",
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: "pre",
                  color: "var(--text)",
                }}
              >
                <span className="tok-com"># sample tests</span>
                {"\n"}
                {problem.test_cases
                  .map(
                    (tc) =>
                      `assert ${problem.method_name}(${JSON.stringify(
                        tc.input,
                      )}) == ${JSON.stringify(tc.expected)}`,
                  )
                  .join("\n")}
                {"\n\n"}
                <span className="tok-com"># run with ⌘↵</span>
              </pre>
            )}
            {tab === "submissions" && (
              <div style={{ position: "absolute", inset: 0 }}>
                <SubmissionsTab
                  fetchAttempts={() => getMyAttempts(problem.id)}
                  refreshKey={submissionsRefreshKey}
                  onRestore={(c) => {
                    setCode(c);
                    setTab("sol");
                  }}
                />
              </div>
            )}
            {tab === "notes" && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down your approach, edge cases, or whatever helps you think…"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  outline: 0,
                  resize: "none",
                  background: "transparent",
                  color: "var(--text)",
                  padding: "20px 28px",
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: "inherit",
                }}
              />
            )}
            {tab === "scratch" && (
              <div
                className="placeholder-stripes"
                style={{ width: "100%", height: "100%", opacity: 0.5 }}
              />
            )}
          </div>
          <RunPanel
            output={outputLines}
            verdict={interviewMode ? (verdict ? "Accepted" : null) : verdict}
            runtimeMs={totalRuntimeMs}
            running={running}
            onClear={() => setResult(null)}
            hideStats={interviewMode}
          />
        </div>
        {errorMsg && (
          <div
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: "var(--rose)",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            Pyodide: {errorMsg}
          </div>
        )}
      </div>

      {/* Right side: stacked side-by-side */}
      <div
        className="row"
        style={{
          borderLeft: "1px solid var(--border)",
          height: "100%",
          gap: 0,
        }}
      >
        {analysisOpen && analysisReady && analysisAttemptId != null && (
          <div
            className="anim-slide-up"
            style={{
              width: 380,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              background: "var(--surface-glass)",
              height: "100%",
            }}
          >
            <AnalysisPanel
              attemptId={analysisAttemptId}
              problemId={problem.id}
              problemSlug={problem.slug}
              onClose={() => setAnalysisOpen(false)}
            />
          </div>
        )}
        {coachOpen ? (
          <CoachPanel
            problemId={problem.id}
            code={code}
            lastRunOutput={lastRunOutput}
            open={coachOpen}
            onClose={() => setCoachOpen(false)}
            lockedMode={interviewMode ? "interview" : undefined}
          />
        ) : (
          !analysisOpen && (
            <div
              style={{
                width: 40,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "10px 0",
                gap: 6,
                background: "var(--surface-glass)",
              }}
            >
              <IconButton
                icon="sparkle"
                sm
                title="Coach (⌘J)"
                onClick={() => setCoachOpen(true)}
              />
              {analysisReady && (
                <IconButton
                  icon="spark"
                  sm
                  title="Analysis (⌘I)"
                  onClick={() => setAnalysisOpen(true)}
                />
              )}
            </div>
          )
        )}
      </div>

      {interviewMode && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            padding: "10px 14px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            zIndex: 20,
          }}
        >
          <span style={{ display: "inline-flex", color: "var(--accent)" }}>
            <Icon name="clock" size={14} />
          </span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
            {formatMs(remainingMs)}
          </span>
          <div className="vr" style={{ height: 18 }} />
          <span style={{ display: "inline-flex" }} className="muted">
            <Icon name="lock" size={12} />
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            coach locked
          </span>
        </div>
      )}

      {ended && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="glass"
            style={{
              padding: "24px 32px",
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600 }}>
              Session ended
            </h2>
            <p
              className="muted"
              style={{ margin: 0, fontSize: 13 }}
            >
              Your final attempt has been submitted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

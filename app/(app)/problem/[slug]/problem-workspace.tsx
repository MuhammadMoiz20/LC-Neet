"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Problem } from "@/lib/problems/types";
import { CodeEditor } from "@/components/code-editor";
import { usePyodideRunner } from "@/lib/pyodide/use-pyodide-runner";
import type { CustomResult, RunResult } from "@/lib/pyodide/worker-protocol";
import { submitAttempt, getMyAttempts } from "./actions";
import { markRevisit, markStarted } from "@/app/(app)/board/actions";
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
  // Opening a problem is what moves it from Not started to Attempting.
  useEffect(() => {
    markStarted(problem.id).catch(() => {});
  }, [problem.id]);

  // The tab bar says "autosaved", so make it true: keep the draft in this
  // browser and restore it on return. Interview rounds always start clean.
  // `code` only reaches client-only components, so reading storage in the
  // initializer can't cause a hydration mismatch.
  const draftKey = interviewMode ? null : `lcn-draft-${problem.slug}`;
  const [code, setCode] = useState(() => {
    if (draftKey && typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(draftKey) ?? problem.starter_code;
      } catch {}
    }
    return problem.starter_code;
  });
  useEffect(() => {
    if (!draftKey) return;
    try {
      // Untouched starter code is not a draft: storing it would pin an old
      // starter in this browser after the catalog's is corrected.
      if (code === problem.starter_code) window.localStorage.removeItem(draftKey);
      else window.localStorage.setItem(draftKey, code);
    } catch {}
  }, [draftKey, code, problem.starter_code]);
  // Notes persist the same way as the draft; `notes` only feeds a textarea
  // that renders after a tab click, so no hydration mismatch here either.
  const notesKey = interviewMode ? null : `lcn-notes-${problem.slug}`;
  const [notes, setNotes] = useState(() => {
    if (notesKey && typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(notesKey) ?? "";
      } catch {}
    }
    return "";
  });
  useEffect(() => {
    if (!notesKey) return;
    try {
      window.localStorage.setItem(notesKey, notes);
    } catch {}
  }, [notesKey, notes]);
  const [revisitPending, setRevisitPending] = useState(false);
  async function onRevisit() {
    if (revisitPending) return;
    setRevisitPending(true);
    try {
      await markRevisit(problem.id);
      toast("Marked. It'll be back in your queue tomorrow.", { kind: "success" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't mark for revisit", {
        kind: "error",
      });
    } finally {
      setRevisitPending(false);
    }
  }
  const [tab, setTab] = useState<WorkspaceTabId>("sol");
  const [lang, setLang] = useState<EditorLang>("Python 3");
  const [result, setResult] = useState<RunResult | null>(null);
  const [customResult, setCustomResult] = useState<CustomResult | null>(null);
  // What the Python worker is doing for this workspace. One thing at a time:
  // idle (null) ──► run | submit | custom ──► idle. Stop is available throughout.
  const [activity, setActivity] = useState<"run" | "submit" | "custom" | null>(
    null,
  );
  const running = activity === "run" || activity === "submit";
  const [submitted, setSubmitted] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [analysisAttemptId, setAnalysisAttemptId] = useState<number | null>(
    null,
  );
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [submissionsRefreshKey, setSubmissionsRefreshKey] = useState(0);
  const { status: pyStatus, run, runCustom, cancel, errorMsg } = usePyodideRunner();
  const pythonReady = pyStatus === "ready" || pyStatus === "running";

  // Interview session: active ──► expired (final attempt auto-submitted once).
  const [endsAt] = useState(() =>
    interviewMode ? Date.now() + interviewDurationMin * 60_000 : 0,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    interviewMode ? interviewDurationMin * 60_000 : 0,
  );
  const [interviewAttemptId, setInterviewAttemptId] = useState<number | null>(
    null,
  );
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
      if (activity !== null || !pythonReady) return;
      setActivity(mode);
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
        if (interviewMode) setInterviewAttemptId(attemptId);
        if (allPassed && !interviewMode) {
          fetch(`/api/analysis/${attemptId}`, { method: "POST" }).catch(
            () => {},
          );
          setAnalysisAttemptId(attemptId);
          setSubmitted(true);
          // An accepted solution is no longer a draft (it stays restorable from
          // Submissions), so the next visit, often a review, starts clean.
          if (draftKey) {
            try {
              window.localStorage.removeItem(draftKey);
            } catch {}
          }
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
        setActivity(null);
      }
    },
    [
      code,
      problem.test_cases,
      problem.method_name,
      problem.id,
      run,
      interviewMode,
      pythonReady,
      activity,
      draftKey,
    ],
  );

  const performCustomRun = useCallback(
    async (inputJson: string) => {
      if (activity !== null || !pythonReady) return;
      setActivity("custom");
      try {
        const r = await runCustom(code, inputJson, problem.method_name);
        setCustomResult(r);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "run failed";
        if (msg !== "cancelled") toast(msg, { kind: "error" });
      } finally {
        setActivity(null);
      }
    },
    [code, problem.method_name, runCustom, pythonReady, activity],
  );

  // Auto-submit on timer expiry. If a run is still in flight (or Python is
  // reloading after Stop) this waits for it rather than dropping the submit.
  useEffect(() => {
    if (!expired || autoSubmittedRef.current) return;
    if (activity !== null || !pythonReady) return;
    // Deferred a tick: starting a run sets state, which an effect body must not.
    const t = setTimeout(() => {
      autoSubmittedRef.current = true;
      performRun("submit").catch(() => {});
    });
    return () => clearTimeout(t);
  }, [expired, activity, pythonReady, performRun]);

  // Workspace-scoped keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "Enter") {
        // Other fields (coach, custom input) own their Enter, and nothing runs
        // by hand once an interview has expired.
        const inEditor =
          e.target instanceof HTMLElement && !!e.target.closest(".monaco-editor");
        if (expired || (isEditableTarget(e.target) && !inEditor)) return;
        // Works from inside the editor too, which is where the cursor usually
        // is. stopPropagation keeps Monaco from also inserting a line.
        e.preventDefault();
        e.stopPropagation();
        performRun(e.shiftKey ? "submit" : "run");
        return;
      }
      // Letter shortcuts stay out of text fields, where they mean other things.
      if (isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "b") {
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
    // Capture phase, so this runs before Monaco's own key handling.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [performRun, analysisAttemptId, expired]);

  const analysisReady = analysisAttemptId != null && submitted;

  // The command palette lives in the app shell; it asks for a panel toggle with
  // a cancelable event, and cancelling tells it the request was handled here.
  useEffect(() => {
    function onCoach(e: Event) {
      e.preventDefault();
      setCoachOpen((o) => !o);
    }
    function onAnalysis(e: Event) {
      if (!analysisReady) return;
      e.preventDefault();
      setAnalysisOpen((o) => !o);
    }
    window.addEventListener("lcn:toggle-coach", onCoach);
    window.addEventListener("lcn:toggle-analysis", onAnalysis);
    return () => {
      window.removeEventListener("lcn:toggle-coach", onCoach);
      window.removeEventListener("lcn:toggle-analysis", onAnalysis);
    };
  }, [analysisReady]);

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
      <PromptRail
        problem={problem}
        collapsed={promptCollapsed}
        onToggle={() => setPromptCollapsed((c) => !c)}
        hideHints={interviewMode}
      />
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
          running={activity !== null}
          pythonReady={pythonReady}
          hasAnalysis={analysisReady}
          analysisOpen={analysisOpen}
          onOpenAnalysis={() => setAnalysisOpen((o) => !o)}
          lang={lang}
          setLang={setLang}
          hideSubmitInIv={false}
          onRevisit={interviewMode ? undefined : onRevisit}
          revisitPending={revisitPending}
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
            onClear={() => { setResult(null); setCustomResult(null); }}
            hideStats={interviewMode}
            customInputDefault={JSON.stringify(problem.test_cases[0]?.input ?? {}, null, 2)}
            customResult={customResult}
            customRunning={activity === "custom"}
            onRunCustom={performCustomRun}
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

      {expired && (
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
              style={{ margin: "0 0 14px", fontSize: 13 }}
            >
              {activity === "submit"
                ? "Submitting your final attempt…"
                : interviewAttemptId != null
                  ? "Your final attempt has been submitted."
                  : "Time's up."}
            </p>
            <div className="row" style={{ gap: 8, justifyContent: "center" }}>
              {interviewAttemptId != null && activity === null && (
                <Link
                  href={`/analysis/${interviewAttemptId}`}
                  className="btn btn-primary btn-sm"
                >
                  View debrief
                </Link>
              )}
              <Link href="/" className="btn btn-sm">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

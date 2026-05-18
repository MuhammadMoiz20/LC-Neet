# Custom Input + Stdout Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users (a) see `print()` output inline under each sample-test result, and (b) type a custom JSON input and see the solution's return value + stdout (LeetCode "Run Code" style).

**Architecture:** The Pyodide harness already captures stdout per case — the UI just discards it. Task 1 surfaces it. Tasks 2–6 add a parallel `run_custom` path (harness → worker → React hook → UI) that runs one ad-hoc case without an `expected` comparison and returns `{actual, stdout, error, elapsed_ms}`.

**Tech Stack:** Next.js 16, React, TypeScript, Pyodide (Web Worker), Vitest.

**Design reference:** `docs/plans/2026-05-18-custom-input-and-stdout-design.md`

---

## Task 1: Surface stdout under each sample-test result

**Files:**
- Modify: `components/workspace/run-panel.tsx` (function `buildOutputLines`, lines 12–62)
- Create: `components/workspace/run-panel.test.ts`

**Step 1: Write the failing test**

Create `components/workspace/run-panel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildOutputLines } from "./run-panel";
import type { RunResult } from "@/lib/pyodide/worker-protocol";

describe("buildOutputLines stdout", () => {
  it("emits indented stdout lines under a passing test", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        {
          passed: true,
          actual: 3,
          expected: 3,
          stdout: "debug: i=0\ndebug: i=1\n",
          elapsed_ms: 4,
          error: null,
        },
      ],
    };
    const lines = buildOutputLines(result, false);
    const texts = lines.map((l) => l.text);
    expect(texts).toContain("   debug: i=0");
    expect(texts).toContain("   debug: i=1");
  });

  it("emits stdout under a failing test, before expected/actual", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        {
          passed: false,
          actual: 2,
          expected: 3,
          stdout: "oops\n",
          elapsed_ms: 4,
          error: null,
        },
      ],
    };
    const texts = buildOutputLines(result, false).map((l) => l.text);
    const stdoutIdx = texts.indexOf("   oops");
    const expectedIdx = texts.findIndex((t) => t.startsWith("   expected:"));
    expect(stdoutIdx).toBeGreaterThanOrEqual(0);
    expect(stdoutIdx).toBeLessThan(expectedIdx);
  });

  it("emits nothing extra when stdout is empty", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        { passed: true, actual: 1, expected: 1, stdout: "", elapsed_ms: 1, error: null },
      ],
    };
    const texts = buildOutputLines(result, false).map((l) => l.text);
    expect(texts.some((t) => t.startsWith("   "))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run components/workspace/run-panel.test.ts`
Expected: all three tests FAIL (current `buildOutputLines` ignores `c.stdout`).

**Step 3: Implement stdout rendering in `buildOutputLines`**

In `components/workspace/run-panel.tsx`, modify the `result.results.forEach((c, i) => { ... })` block (lines 30–53). After pushing the `✓`/`✗` header line and BEFORE the existing `expected`/`actual`/`error` lines for the failing branch, append:

```ts
if (c.stdout) {
  for (const s of c.stdout.replace(/\n$/, "").split("\n")) {
    lines.push({ kind: "info", text: `   ${s}` });
  }
}
```

Concretely the loop body becomes:

```ts
result.results.forEach((c, i) => {
  if (c.passed) {
    lines.push({ kind: "pass", text: `✓ test ${i + 1} (${c.elapsed_ms}ms)` });
  } else {
    lines.push({ kind: "fail", text: `✗ test ${i + 1} (${c.elapsed_ms}ms)` });
  }
  if (c.stdout) {
    for (const s of c.stdout.replace(/\n$/, "").split("\n")) {
      lines.push({ kind: "info", text: `   ${s}` });
    }
  }
  if (!c.passed) {
    lines.push({ kind: "info", text: `   expected: ${JSON.stringify(c.expected)}` });
    lines.push({ kind: "info", text: `   actual:   ${JSON.stringify(c.actual)}` });
    if (c.error) lines.push({ kind: "err", text: `   ${c.error}` });
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run components/workspace/run-panel.test.ts`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add components/workspace/run-panel.tsx components/workspace/run-panel.test.ts
git commit -m "feat(run-panel): surface stdout under each sample-test result"
```

---

## Task 2: Extend worker protocol with `runCustom` request/response

**Files:**
- Modify: `lib/pyodide/worker-protocol.ts`

**Step 1: Add the new message variants**

Append to `WorkerRequest` union and add a new result type. Final file:

```ts
export type WorkerRequest =
  | { id: string; type: "init" }
  | {
      id: string;
      type: "run";
      code: string;
      testCasesJson: string;
      methodName: string;
    }
  | {
      id: string;
      type: "runCustom";
      code: string;
      inputJson: string;
      methodName: string;
    };

export type TestResult = {
  passed: boolean;
  actual: unknown;
  expected: unknown;
  stdout: string;
  elapsed_ms: number;
  error: string | null;
};

export type RunResult = {
  compile_error: string | null;
  results: TestResult[];
};

export type CustomResult = {
  compile_error: string | null;
  actual: unknown;
  stdout: string;
  elapsed_ms: number;
  error: string | null;
};

export type WorkerResponse =
  | { id: string; type: "ready" }
  | { id: string; type: "result"; result: RunResult }
  | { id: string; type: "customResult"; result: CustomResult }
  | { id: string; type: "error"; error: string };
```

**Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (Existing call sites only match the prior variants and will keep compiling.)

**Step 3: Commit**

```bash
git add lib/pyodide/worker-protocol.ts
git commit -m "feat(pyodide): add runCustom message types to worker protocol"
```

---

## Task 3: Add `run_custom` entry to the Python harness

**Files:**
- Modify: `lib/pyodide/harness.py` (currently 315 lines; add helpers + entry at the bottom)

**Step 1: Factor shared input prep out of `_run_one`**

In `harness.py`, just above `_run_one` (around line 191), add a helper that prepares kwargs and applies the LeetCode-style splices. This is a pure refactor — `_run_one` will call it.

```python
def _prepare_kwargs(method, raw_input):
    """Build the kwargs dict to pass to `method`, applying the LeetCode
    conventions (`pos` cycle splice, LCA `p`/`q` resolution against `root`).

    Returns: (kwargs, list_key, tree_key) — `list_key`/`tree_key` are the
    first input key that conventionally holds a linked-list head or tree
    root, used by callers to decide how to serialize the return value.
    """
    pos = raw_input.get("pos") if isinstance(raw_input, dict) else None
    kwargs = {
        k: _convert_input(k, v) for k, v in raw_input.items() if k != "pos"
    }
    root_tree = kwargs.get("root") if isinstance(kwargs.get("root"), TreeNode) else None
    if root_tree is not None:
        node_by_val = {}
        stack = [root_tree]
        while stack:
            n = stack.pop()
            if n is None:
                continue
            node_by_val[n.val] = n
            stack.append(n.left)
            stack.append(n.right)
        for key in ("p", "q"):
            if key in kwargs and not isinstance(kwargs[key], TreeNode):
                v = kwargs[key]
                if v in node_by_val:
                    kwargs[key] = node_by_val[v]
    if pos is not None and isinstance(pos, int) and pos >= 0:
        for list_key in _LIST_INPUT_NAMES:
            head = kwargs.get(list_key)
            if head is None or not isinstance(head, ListNode):
                continue
            target = head
            for _ in range(pos):
                if target.next is None:
                    break
                target = target.next
            tail = head
            while tail.next is not None:
                tail = tail.next
            tail.next = target
            break
    list_key = next((k for k in raw_input if k in _LIST_INPUT_NAMES), None)
    tree_key = next((k for k in raw_input if k in _TREE_INPUT_NAMES), None)
    return kwargs, list_key, tree_key


def _serialize_actual(raw_actual, method, kwargs, raw_input, list_key, tree_key, expected):
    """Apply the same return-value serialization `_run_one` uses, so a
    custom run (with no `expected`) produces output shaped the same way."""
    try:
        return_ann = inspect.signature(method).return_annotation
    except (TypeError, ValueError):
        return_ann = inspect.Signature.empty
    ann_str = "" if return_ann is inspect.Signature.empty else str(return_ann)
    returns_list_node = "ListNode" in ann_str
    returns_tree_node = "TreeNode" in ann_str
    if raw_actual is None and list_key is not None and not returns_list_node:
        return _from_list_node(kwargs[list_key])
    if raw_actual is None and tree_key is not None and not returns_tree_node:
        return _from_tree_node(kwargs[tree_key])
    if raw_actual is None and list_key is not None and returns_list_node:
        return []
    if raw_actual is None and tree_key is not None and returns_tree_node:
        return []
    if raw_actual is None and any(k == "lists" for k in raw_input):
        return []
    return _convert_output(raw_actual, expected)
```

Then refactor `_run_one` (lines ~191–293) to use these helpers. Its body becomes:

```python
def _run_one(solution, method_name, case):
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    start = time.perf_counter()
    try:
        method = getattr(solution, method_name)
        raw_input = case["input"]
        kwargs, list_key, tree_key = _prepare_kwargs(method, raw_input)
        raw_actual = method(**kwargs)
        actual = _serialize_actual(
            raw_actual, method, kwargs, raw_input, list_key, tree_key, case["expected"]
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        passed = _equals_allowing_unordered(actual, case["expected"])
        return {
            "passed": passed,
            "actual": actual,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return {
            "passed": False,
            "actual": None,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": traceback.format_exc(),
        }
    finally:
        sys.stdout = real_stdout
```

**Step 2: Add `_run_custom` and `run_custom` entry point**

After `_run_one`, add:

```python
def _run_custom(solution, method_name, raw_input):
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    start = time.perf_counter()
    try:
        method = getattr(solution, method_name)
        kwargs, list_key, tree_key = _prepare_kwargs(method, raw_input)
        raw_actual = method(**kwargs)
        # No expected available; pass None as the comparison hint.
        actual = _serialize_actual(
            raw_actual, method, kwargs, raw_input, list_key, tree_key, None
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return {
            "actual": actual,
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return {
            "actual": None,
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": traceback.format_exc(),
        }
    finally:
        sys.stdout = real_stdout
```

At the very bottom of the file, after `run_tests`, add:

```python
def run_custom(user_code: str, input_json: str, method_name: str) -> str:
    """Entry point for a single ad-hoc run with no expected output."""
    raw_input = json.loads(input_json)
    mod = types.ModuleType("user_solution")
    mod.__dict__.update(_USER_NS_INJECT)
    try:
        exec(user_code, mod.__dict__)
    except Exception:
        return json.dumps({
            "compile_error": traceback.format_exc(),
            "actual": None,
            "stdout": "",
            "elapsed_ms": 0,
            "error": None,
        })
    if "Solution" not in mod.__dict__:
        return json.dumps({
            "compile_error": "Your code must define a `Solution` class.",
            "actual": None,
            "stdout": "",
            "elapsed_ms": 0,
            "error": None,
        })
    solution = mod.Solution()
    result = _run_custom(solution, method_name, raw_input)
    return json.dumps({"compile_error": None, **result})
```

**Step 3: Sanity-check the Python parses**

Run: `python3 -c "import py_compile; py_compile.compile('lib/pyodide/harness.py', doraise=True); print('ok')"`
Expected: `ok`.

**Step 4: Verify existing sample-test path still works manually**

Run: `npm run dev` in another shell, open a problem, hit ⌘↵ on the starter code, confirm sample tests still report pass/fail as before (the refactor is behavior-preserving). Then Ctrl-C the dev server.

**Step 5: Commit**

```bash
git add lib/pyodide/harness.py
git commit -m "feat(harness): add run_custom entry for single ad-hoc input"
```

---

## Task 4: Wire `runCustom` through the Pyodide worker

**Files:**
- Modify: `lib/pyodide/worker.ts`

**Step 1: Handle the new message type**

In `lib/pyodide/worker.ts`, inside `self.onmessage`, add a branch after the existing `if (msg.type === "run")` block:

```ts
if (msg.type === "runCustom") {
  await init();
  const py = self.pyodide!;
  const setGlobal = (py.globals as unknown as {
    set: (k: string, v: unknown) => void;
  }).set;
  setGlobal("__user_code", msg.code);
  setGlobal("__input_json", msg.inputJson);
  setGlobal("__method_name", msg.methodName);
  const raw = await py.runPythonAsync(
    "run_custom(__user_code, __input_json, __method_name)",
  );
  post({
    id: msg.id,
    type: "customResult",
    result: JSON.parse(String(raw)),
  });
  return;
}
```

(You can also DRY up the three repeated `setGlobal` lines in the existing `"run"` branch using the same local helper if you like — small, optional refactor.)

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 3: Commit**

```bash
git add lib/pyodide/worker.ts
git commit -m "feat(pyodide): worker dispatches runCustom to harness.run_custom"
```

---

## Task 5: Add `runCustom` to `usePyodideRunner`

**Files:**
- Modify: `lib/pyodide/use-pyodide-runner.ts`

**Step 1: Export a `runCustom` method from the hook**

After the existing `run` `useCallback` (ends around line 98), add:

```ts
const runCustom = useCallback(
  (code: string, inputJson: string, methodName: string) =>
    new Promise<CustomResult>((resolve, reject) => {
      const w = workerRef.current;
      if (!w) return reject(new Error("Worker not ready"));
      const id = randomId();
      pendingRef.current.set(id, (resp) => {
        if (resp.type === "customResult") resolve(resp.result);
        else if (resp.type === "error") reject(new Error(resp.error));
      });
      setStatus("running");
      w.postMessage({
        id,
        type: "runCustom",
        code,
        inputJson,
        methodName,
      } satisfies WorkerRequest);
    }).finally(() => {
      if (workerRef.current) setStatus("ready");
    }),
  [],
);

return { status, errorMsg, run, runCustom, cancel };
```

Also update the import at the top to include `CustomResult`:

```ts
import type {
  CustomResult,
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 3: Commit**

```bash
git add lib/pyodide/use-pyodide-runner.ts
git commit -m "feat(pyodide): expose runCustom from usePyodideRunner hook"
```

---

## Task 6: Add the Custom Input UI to `RunPanel`

**Files:**
- Modify: `components/workspace/run-panel.tsx`

**Step 1: Extend `RunPanel`'s props**

Add (optional) props so the parent can drive the custom-input section without breaking other callers:

```ts
import { useState } from "react";
import type { CustomResult } from "@/lib/pyodide/worker-protocol";

// new optional props on RunPanel:
customInputDefault?: string;          // prefilled JSON kwargs
customResult?: CustomResult | null;   // last custom-run result
customRunning?: boolean;
onRunCustom?: (inputJson: string) => void;
```

**Step 2: Render the collapsible section above the output area**

Inside `RunPanel`, before the existing output `<div className="mono">`, add:

```tsx
{onRunCustom && (
  <CustomInputSection
    defaultValue={customInputDefault ?? ""}
    running={!!customRunning}
    result={customResult ?? null}
    onRun={onRunCustom}
  />
)}
```

Then at the bottom of the file, define:

```tsx
function CustomInputSection({
  defaultValue,
  running,
  result,
  onRun,
}: {
  defaultValue: string;
  running: boolean;
  result: CustomResult | null;
  onRun: (inputJson: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultValue);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleRun = () => {
    try {
      JSON.parse(text);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "invalid JSON");
      return;
    }
    setParseError(null);
    onRun(text);
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="row"
        style={{
          width: "100%",
          padding: "6px 12px",
          gap: 8,
          fontSize: 11,
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          fontWeight: 600,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={10} />
        Custom input
      </button>
      {open && (
        <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="mono"
            style={{
              width: "100%",
              minHeight: 70,
              fontSize: 12.5,
              padding: 8,
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              resize: "vertical",
            }}
          />
          {parseError && (
            <div className="mono" style={{ color: "var(--rose)", fontSize: 12 }}>
              JSON parse error: {parseError}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="btn btn-sm"
            >
              {running ? "Running…" : "Run custom"}
            </button>
            <span className="muted mono" style={{ fontSize: 11 }}>
              JSON kwargs, e.g. {`{"nums":[2,7,11,15],"target":9}`}
            </span>
          </div>
          {result && (
            <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>
              {result.compile_error && (
                <div style={{ color: "var(--rose)", whiteSpace: "pre-wrap" }}>
                  {result.compile_error}
                </div>
              )}
              {result.stdout && (
                <>
                  <div className="muted">Stdout:</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.stdout}</pre>
                </>
              )}
              {!result.compile_error && (
                <>
                  <div className="muted">Output:</div>
                  <div>{JSON.stringify(result.actual)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{result.elapsed_ms}ms</div>
                </>
              )}
              {result.error && (
                <div style={{ color: "var(--rose)", whiteSpace: "pre-wrap" }}>
                  {result.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Pick whatever icon names exist on the project's `Icon` component for the chevrons; if `chevron-down`/`chevron-right` aren't registered, fall back to a `▸`/`▾` text glyph.

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 4: Commit**

```bash
git add components/workspace/run-panel.tsx
git commit -m "feat(run-panel): add Custom Input section with output + stdout"
```

---

## Task 7: Wire custom input from the problem workspace

**Files:**
- Modify: `app/(app)/problem/[slug]/problem-workspace.tsx`

**Step 1: Pull `runCustom` from the hook + manage state**

In `problem-workspace.tsx`:

- Change the hook destructure on line 74 to also pull `runCustom`:
  ```ts
  const { status: pyStatus, run, runCustom, cancel, errorMsg } = usePyodideRunner();
  ```
- Import `CustomResult`:
  ```ts
  import type { CustomResult, RunResult } from "@/lib/pyodide/worker-protocol";
  ```
- Add state near the existing `result` state (line 64):
  ```ts
  const [customResult, setCustomResult] = useState<CustomResult | null>(null);
  const [customRunning, setCustomRunning] = useState(false);
  ```
- Add a handler near `performRun`:
  ```ts
  const performCustomRun = useCallback(
    async (inputJson: string) => {
      if (customRunning) return;
      if (pyStatus !== "ready" && pyStatus !== "running") return;
      setCustomRunning(true);
      try {
        const r = await runCustom(code, inputJson, problem.method_name);
        setCustomResult(r);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "run failed";
        if (msg !== "cancelled") toast(msg, { kind: "error" });
      } finally {
        setCustomRunning(false);
      }
    },
    [code, problem.method_name, runCustom, pyStatus, customRunning],
  );
  ```

**Step 2: Pass the new props to `<RunPanel />`**

At the existing `<RunPanel ... />` site (~line 338), add:

```tsx
<RunPanel
  /* existing props */
  customInputDefault={JSON.stringify(problem.test_cases[0]?.input ?? {}, null, 2)}
  customResult={customResult}
  customRunning={customRunning}
  onRunCustom={performCustomRun}
/>
```

Also clear `customResult` in the existing `onClear`:

```tsx
onClear={() => { setResult(null); setCustomResult(null); }}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 4: Manual verification (golden path + edge cases)**

Run: `npm run dev`, then in a browser:

1. Open `/problem/two-sum`. The "Custom input" section is collapsed below the Run header. Expand it — textarea is prefilled with `{ "nums": [2,7,11,15], "target": 9 }`.
2. Click "Run custom". Within a couple seconds: **Output: [0,1]** appears.
3. Add `print("hi")` somewhere in the Solution method body, click "Run custom" again. **Stdout: hi** appears above the Output.
4. Click ⌘↵ to run the sample tests. Confirm `hi` shows up indented under each `✓ test N` line.
5. Edit the textarea to invalid JSON (`{nums: [1,2]}`). Click Run custom — red "JSON parse error: …" appears; worker is NOT invoked.
6. Edit textarea to `{"nums": [1,2,3], "target": 99}` (no answer). Click Run custom — **Output: null** (the method returns None for two-sum with no pair; serializer leaves it as-is). No crash.
7. Trigger a Python error: change the method body to `raise ValueError("x")`. Click Run custom — red traceback appears.

Stop the dev server.

**Step 5: Commit**

```bash
git add 'app/(app)/problem/[slug]/problem-workspace.tsx'
git commit -m "feat(workspace): wire custom-input runner into problem page"
```

---

## Final verification

Run the full test suite to make sure nothing regressed:

```bash
npx vitest run
npx tsc --noEmit
```

Both should pass.

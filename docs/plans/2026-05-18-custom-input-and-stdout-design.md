# Custom Input + Stdout Visibility in Run Panel

## Goal

Let the user (a) type a custom input and see the solution's return value and
`print()` output, and (b) see `print()` output inline under each sample-test
result. LeetCode-style "Run Code" experience.

## Scope

In:

- A collapsible "Custom input" section at the top of the Run panel with a
  prefilled JSON textarea and a "Run custom" button.
- A new worker/harness path that runs a single ad-hoc case without an
  `expected` comparison.
- Rendering captured `stdout` under each sample-test result (data already
  exists on every harness result — just unused by the UI today).

Out:

- Persisting custom inputs across reloads.
- Saving multiple named custom cases.
- Syntax highlighting in the input textarea.
- Promoting custom input to a dedicated tab.

## Approach

### Input format

JSON kwargs, matching `test_cases[i].input` exactly
(e.g. `{"nums":[2,7,11,15],"target":9}`). The textarea is prefilled with
`JSON.stringify(problem.test_cases[0].input, null, 2)`, so the common case is
"edit one number and hit run."

### Harness (`lib/pyodide/harness.py`)

Add `_run_custom(solution, method_name, raw_input)`:

- Mirrors `_run_one`'s input handling (the `pos` cycle splice, LCA `p`/`q`
  resolution, list/tree return-type inference, stdout capture).
- Skips `expected` and the equality check.
- Returns `{actual, stdout, error, elapsed_ms}`.

The shared input-prep logic should be factored into a helper so `_run_one`
and `_run_custom` don't drift. Output serialization for `actual` when there
is no `expected` falls back to the existing list/tree-aware path with a
sentinel `None` expected.

Add a top-level entry (`run_custom(...)`) callable from the worker, parallel
to whatever the worker calls today for sample tests.

### Worker (`lib/pyodide/worker.ts`)

Add a message type `runCustom` carrying `{ code, methodName, input }`. It
calls the new harness entry and posts back `{actual, stdout, error, elapsed_ms}`.

### Run panel (`components/workspace/run-panel.tsx`)

- New `<CustomInputSection />` subcomponent: collapsible, textarea, "Run
  custom" button, ⇧⌘↵ shortcut, inline JSON parse error.
- New `customResult` state alongside the existing sample-tests state. The
  output area branches: sample-tests render the per-case list; custom
  renders a single "Output:" + "Stdout:" + (optional) "Error:" block.
- For sample tests: under each `✓/✗ test N (Nms)` line, render `c.stdout`
  as an indented, dimmed `<pre>` if non-empty.

## Error handling

- JSON parse error in custom input: show inline above the textarea, do not
  invoke the worker.
- Python exception during custom run: surface `error` (traceback) in a red
  block, alongside any captured stdout.
- Worker crash / Pyodide load failure: existing error path unchanged.

## Testing

- Unit test the harness `_run_custom` directly in
  `lib/pyodide/harness.py`'s existing Python test surface (if any), or via a
  small Vitest that drives the worker.
- Manual: load two-sum, edit the prefilled input, run, confirm output. Add
  a `print()` in a sample solution and confirm stdout appears under each
  sample-test line.

## Files touched

- `lib/pyodide/harness.py`
- `lib/pyodide/worker.ts`
- `components/workspace/run-panel.tsx`
- Possibly a small extraction in `components/workspace/section.tsx` if a
  reusable collapsible already lives there.

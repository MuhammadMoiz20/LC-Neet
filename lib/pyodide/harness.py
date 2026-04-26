"""Test harness executed inside Pyodide.

Loads the user's solution module, instantiates `Solution`, calls
`<method_name>(**case["input"])`, compares to `case["expected"]`,
captures stdout and exceptions per case.
"""

import io
import json
import sys
import time
import traceback
import types


def _run_one(solution, method_name, case):
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    start = time.perf_counter()
    try:
        method = getattr(solution, method_name)
        actual = method(**case["input"])
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        passed = actual == case["expected"]
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


def run_tests(user_code: str, test_cases_json: str, method_name: str) -> str:
    """Entry point called from JS. Returns JSON string."""
    cases = json.loads(test_cases_json)
    mod = types.ModuleType("user_solution")
    try:
        exec(user_code, mod.__dict__)
    except Exception:
        return json.dumps({
            "compile_error": traceback.format_exc(),
            "results": [],
        })
    if "Solution" not in mod.__dict__:
        return json.dumps({
            "compile_error": "Your code must define a `Solution` class.",
            "results": [],
        })
    solution = mod.Solution()
    results = [_run_one(solution, method_name, c) for c in cases]
    return json.dumps({"compile_error": None, "results": results})

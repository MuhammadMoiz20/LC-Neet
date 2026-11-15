/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

declare const self: DedicatedWorkerGlobalScope & {
  loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideAPI>;
  pyodide?: PyodideAPI;
};

type PyodideAPI = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { get: (name: string) => unknown };
};

let initPromise: Promise<void> | null = null;

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Fetch the harness while Pyodide downloads instead of after it. Never
    // cached, so a deploy can't leave a stale harness behind.
    const harness = fetch(`/api/harness?t=${Date.now()}`, {
      cache: "no-store",
    }).then((res) => {
      if (!res.ok) throw new Error(`harness failed to load (${res.status})`);
      return res.text();
    });
    harness.catch(() => {}); // surfaced by the await below, not as an unhandled rejection
    self.importScripts(`${PYODIDE_CDN}pyodide.js`);
    self.pyodide = await self.loadPyodide!({ indexURL: PYODIDE_CDN });
    await self.pyodide.runPythonAsync(await harness);
  })();
  return initPromise;
}

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await init();
      post({ id: msg.id, type: "ready" });
      return;
    }
    if (msg.type === "run") {
      await init();
      const py = self.pyodide!;
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__user_code",
        msg.code,
      );
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__cases_json",
        msg.testCasesJson,
      );
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__method_name",
        msg.methodName,
      );
      const raw = await py.runPythonAsync(
        "run_tests(__user_code, __cases_json, __method_name)",
      );
      post({
        id: msg.id,
        type: "result",
        result: JSON.parse(String(raw)),
      });
    }
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
  } catch (err) {
    post({
      id: msg.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

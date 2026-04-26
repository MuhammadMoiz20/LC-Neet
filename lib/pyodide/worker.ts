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

let harnessSource: string | null = null;
let initPromise: Promise<void> | null = null;

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    self.importScripts(`${PYODIDE_CDN}pyodide.js`);
    self.pyodide = await self.loadPyodide!({ indexURL: PYODIDE_CDN });
    if (!harnessSource) {
      const res = await fetch("/api/harness");
      harnessSource = await res.text();
    }
    await self.pyodide.runPythonAsync(harnessSource);
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
  } catch (err) {
    post({
      id: msg.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

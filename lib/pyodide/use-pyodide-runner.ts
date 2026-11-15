"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CustomResult,
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * The Python worker's lifecycle. `status` is the only source of truth.
 *
 *   loading ──► ready ◄──► running
 *      ▲          │           │
 *      └──────────┴───────────┘  cancel(): terminate + respawn
 *   any ──► error                 worker crashed or failed to load
 *
 * Python can't be interrupted from outside without cross-origin isolation, so
 * cancelling means killing the worker and loading a fresh one.
 */
export type RunnerStatus = "loading" | "ready" | "running" | "error";

type Distribute<T> = T extends unknown ? Omit<T, "id"> : never;
type RunRequest = Distribute<Exclude<WorkerRequest, { type: "init" }>>;

export function usePyodideRunner() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, (r: WorkerResponse) => void>>(new Map());
  const inFlightRef = useRef(0);
  const [status, setStatus] = useState<RunnerStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const spawn = useCallback(() => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const cb = pendingRef.current.get(e.data.id);
      if (cb) {
        pendingRef.current.delete(e.data.id);
        cb(e.data);
      }
    };
    w.onerror = (e) => {
      setStatus("error");
      setErrorMsg(e.message);
    };
    const id = randomId();
    pendingRef.current.set(id, (resp) => {
      if (resp.type === "ready") {
        // A run queued while Python was still loading keeps the worker busy.
        setStatus(inFlightRef.current > 0 ? "running" : "ready");
      } else if (resp.type === "error") {
        setStatus("error");
        setErrorMsg(resp.error);
      }
    });
    w.postMessage({ id, type: "init" } satisfies WorkerRequest);
    return w;
  }, []);

  useEffect(() => {
    const pending = pendingRef.current;
    const w = spawn();
    return () => {
      w.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, [spawn]);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    // Reject all pending callers so their promises settle.
    const waiting = [...pendingRef.current.values()];
    pendingRef.current.clear();
    inFlightRef.current = 0;
    for (const cb of waiting) cb({ id: "", type: "error", error: "cancelled" });
    setStatus("loading");
    setErrorMsg(null);
    spawn();
  }, [spawn]);

  const send = useCallback(<T,>(req: RunRequest, pick: (r: WorkerResponse) => T | undefined) => {
    const w = workerRef.current;
    if (!w) return Promise.reject<T>(new Error("Worker not ready"));
    return new Promise<T>((resolve, reject) => {
      const id = randomId();
      pendingRef.current.set(id, (resp) => {
        const value = pick(resp);
        if (value !== undefined) resolve(value);
        else reject(new Error(resp.type === "error" ? resp.error : "unexpected worker reply"));
      });
      inFlightRef.current += 1;
      setStatus("running");
      w.postMessage({ ...req, id } as WorkerRequest);
    }).finally(() => {
      // After cancel() the worker has been replaced and is loading again;
      // only the worker that ran this request may report itself ready.
      if (workerRef.current !== w) return;
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setStatus("ready");
    });
  }, []);

  const run = useCallback(
    (code: string, testCasesJson: string, methodName: string) =>
      send<RunResult>({ type: "run", code, testCasesJson, methodName }, (r) =>
        r.type === "result" ? r.result : undefined,
      ),
    [send],
  );

  const runCustom = useCallback(
    (code: string, inputJson: string, methodName: string) =>
      send<CustomResult>({ type: "runCustom", code, inputJson, methodName }, (r) =>
        r.type === "customResult" ? r.result : undefined,
      ),
    [send],
  );

  return { status, errorMsg, run, runCustom, cancel };
}

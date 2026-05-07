"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type Status = "idle" | "loading" | "ready" | "running" | "error";

export function usePyodideRunner() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<
    Map<string, (r: WorkerResponse) => void>
  >(new Map());
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const spawn = useCallback(() => {
    const w = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const cb = pendingRef.current.get(e.data.id);
      if (cb) {
        cb(e.data);
        pendingRef.current.delete(e.data.id);
      }
    };
    w.onerror = (e) => {
      setStatus("error");
      setErrorMsg(e.message);
    };
    setStatus("loading");
    setErrorMsg(null);
    const id = randomId();
    pendingRef.current.set(id, (resp) => {
      if (resp.type === "ready") setStatus("ready");
      else if (resp.type === "error") {
        setStatus("error");
        setErrorMsg(resp.error);
      }
    });
    w.postMessage({ id, type: "init" } satisfies WorkerRequest);
    return w;
  }, []);

  useEffect(() => {
    const w = spawn();
    return () => {
      w.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, [spawn]);

  const cancel = useCallback(() => {
    const w = workerRef.current;
    if (w) w.terminate();
    // Reject all pending callers so their promises settle.
    for (const cb of pendingRef.current.values()) {
      cb({ id: "", type: "error", error: "cancelled" });
    }
    pendingRef.current.clear();
    workerRef.current = null;
    spawn();
  }, [spawn]);

  const run = useCallback(
    (code: string, testCasesJson: string, methodName: string) =>
      new Promise<RunResult>((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error("Worker not ready"));
        const id = randomId();
        pendingRef.current.set(id, (resp) => {
          if (resp.type === "result") resolve(resp.result);
          else if (resp.type === "error") reject(new Error(resp.error));
        });
        setStatus("running");
        w.postMessage({
          id,
          type: "run",
          code,
          testCasesJson,
          methodName,
        } satisfies WorkerRequest);
      }).finally(() => {
        // Only flip to ready if the worker is still alive (not cancelled).
        if (workerRef.current) setStatus("ready");
      }),
    [],
  );

  return { status, errorMsg, run, cancel };
}

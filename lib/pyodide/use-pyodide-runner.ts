"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

type Status = "idle" | "loading" | "ready" | "running" | "error";

export function usePyodideRunner() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<
    Map<string, (r: WorkerResponse) => void>
  >(new Map());
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
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
    const id = crypto.randomUUID();
    pendingRef.current.set(id, (resp) => {
      if (resp.type === "ready") setStatus("ready");
      else if (resp.type === "error") {
        setStatus("error");
        setErrorMsg(resp.error);
      }
    });
    w.postMessage({ id, type: "init" } satisfies WorkerRequest);
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback(
    (code: string, testCasesJson: string, methodName: string) =>
      new Promise<RunResult>((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error("Worker not ready"));
        const id = crypto.randomUUID();
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
      }).finally(() => setStatus("ready")),
    [],
  );

  return { status, errorMsg, run };
}

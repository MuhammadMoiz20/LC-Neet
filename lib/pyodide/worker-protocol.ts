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

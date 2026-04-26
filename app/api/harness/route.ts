import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const src = fs.readFileSync(
    path.join(process.cwd(), "lib/pyodide/harness.py"),
    "utf8",
  );
  return new NextResponse(src, {
    headers: {
      "Content-Type": "text/x-python",
      "Cache-Control": "no-store",
    },
  });
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql is a native (.node) addon — leave it to Node's require instead of
  // letting the bundler try to trace it into the serverless function.
  serverExternalPackages: ["libsql"],
};

export default nextConfig;

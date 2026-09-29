import type { NextConfig } from "next";
import packageJson from "./package.json";

/** Short SHA from CI / Docker build-args — never run `git` (images have no .git). */
function resolveBuildCommit(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_APP_COMMIT?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    "";
  if (!raw) return undefined;
  return raw.slice(0, 7);
}

const buildCommit = resolveBuildCommit();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfjs-dist"],
  env: {
    // Sourced from package.json at build time — bump version there only.
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    ...(buildCommit ? { NEXT_PUBLIC_APP_COMMIT: buildCommit } : {}),
  },
};

export default nextConfig;

import { existsSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");
const routesManifestPath = path.join(nextDir, "routes-manifest.json");
const deterministicPath = path.join(nextDir, "routes-manifest-deterministic.json");

mkdirSync(nextDir, { recursive: true });

if (existsSync(routesManifestPath)) {
  copyFileSync(routesManifestPath, deterministicPath);
  console.log("Copied routes-manifest.json to routes-manifest-deterministic.json");
} else {
  const fallbackManifest = {
    version: 3,
    pages404: true,
    caseSensitive: false,
    basePath: "",
    redirects: [],
    headers: [],
    rewrites: {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    },
    dynamicRoutes: [],
    staticRoutes: [],
    dataRoutes: [],
  };

  writeFileSync(
    deterministicPath,
    `${JSON.stringify(fallbackManifest, null, 2)}\n`,
    "utf8"
  );
  console.log("Wrote fallback routes-manifest-deterministic.json");
}

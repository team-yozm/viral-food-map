import { mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const tempRoot = path.join(projectRoot, ".native-build-temp");

const dynamicRoutes = [
  {
    source: path.join(projectRoot, "src/app/trend/[id]"),
    target: path.join(tempRoot, "trend-[id]"),
  },
  {
    source: path.join(projectRoot, "src/app/yomechu/share/[spinId]"),
    target: path.join(tempRoot, "yomechu-share-[spinId]"),
  },
];

async function moveRoutes(pairs) {
  await mkdir(tempRoot, { recursive: true });

  for (const pair of pairs) {
    if (existsSync(pair.source)) {
      await rename(pair.source, pair.target);
    }
  }
}

async function restoreRoutes(pairs) {
  for (const pair of pairs) {
    if (existsSync(pair.target)) {
      await rename(pair.target, pair.source);
    }
  }
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["next", "build", "--webpack"],
      {
        cwd: projectRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_OUTPUT_MODE: "export",
        },
      }
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`native build failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

try {
  await moveRoutes(dynamicRoutes);
  await runNextBuild();
} finally {
  await restoreRoutes(dynamicRoutes);
}

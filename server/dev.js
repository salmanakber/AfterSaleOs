/**
 * Dev: one public port (default 4500) + worker + Next dev servers.
 *   npm run dev
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const {
  root,
  port,
  host,
  appUrl,
  webInternalPort,
  adminInternalPort,
} = require("./bootstrap");
const { createGateway } = require("./gateway");

const children = [];

function run(command, args, name, cwd) {
  const child = spawn(command, args, {
    stdio: "inherit",
    cwd: cwd || root,
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    console.error(`[${name}] exited with code ${code}`);
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run("npx", ["tsx", "watch", "src/index.ts"], "worker", path.join(root, "apps/worker"));
run(
  "npx",
  ["next", "dev", "-H", "127.0.0.1", "-p", String(webInternalPort)],
  "web",
  path.join(root, "apps/web"),
);
run(
  "npx",
  ["next", "dev", "-H", "127.0.0.1", "-p", String(adminInternalPort)],
  "admin",
  path.join(root, "apps/admin"),
);

createGateway({ port, host, webInternalPort, adminInternalPort, appUrl });

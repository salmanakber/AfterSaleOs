/**
 * Production: one public port (default 4500) + worker.
 *   npm run build && npm start
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
    env: process.env,
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    console.error(`[${name}] exited with code ${code}`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("node", [path.join(root, "apps/worker/dist/index.js")], "worker");
run(
  "npx",
  ["next", "start", "-H", "127.0.0.1", "-p", String(webInternalPort)],
  "web",
  path.join(root, "apps/web"),
);
run(
  "npx",
  ["next", "start", "-H", "127.0.0.1", "-p", String(adminInternalPort)],
  "admin",
  path.join(root, "apps/admin"),
);

createGateway({ port, host, webInternalPort, adminInternalPort, appUrl });

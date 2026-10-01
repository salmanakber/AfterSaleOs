/**
 * Load .env and derive public URLs from APP_URL + PORT.
 * Production: APP_URL=https://aftersale.tidyflowapp.com  PORT=4500
 */
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const port = Number(process.env.PORT ?? 4500);
const host = process.env.HOST ?? "0.0.0.0";
const webInternalPort = Number(process.env.WEB_INTERNAL_PORT ?? 4502);
const adminInternalPort = Number(process.env.ADMIN_INTERNAL_PORT ?? 4501);

let appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
if (!appUrl) {
  appUrl = `http://localhost:${port}`;
}

process.env.PORT = String(port);
process.env.HOST = host;
process.env.APP_URL = appUrl;
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || appUrl;
process.env.ADMIN_URL = `${appUrl}/admin`;
process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = "/admin";
process.env.WEB_INTERNAL_PORT = String(webInternalPort);
process.env.ADMIN_INTERNAL_PORT = String(adminInternalPort);

module.exports = {
  root,
  port,
  host,
  appUrl,
  webInternalPort,
  adminInternalPort,
};

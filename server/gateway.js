/**
 * Single public port gateway.
 *   /admin/*  → Super Admin (internal ADMIN_INTERNAL_PORT)
 *   /*        → Merchant web + APIs (internal WEB_INTERNAL_PORT)
 */
const http = require("node:http");

function forward(req, res, targetPort) {
  const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Bad gateway (${targetPort}): ${err.message}`);
  });
  req.pipe(proxyReq);
}

function createGateway({ port, host, webInternalPort, adminInternalPort, appUrl }) {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/admin" || url.startsWith("/admin/") || url.startsWith("/admin?")) {
      forward(req, res, adminInternalPort);
      return;
    }
    forward(req, res, webInternalPort);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "/";
    const targetPort =
      url.startsWith("/admin") || url.startsWith("/_next") && req.headers.referer?.includes("/admin")
        ? adminInternalPort
        : url.startsWith("/admin")
          ? adminInternalPort
          : webInternalPort;
    const dest = url.startsWith("/admin") ? adminInternalPort : webInternalPort;

    const proxyReq = http.request({
      hostname: "127.0.0.1",
      port: dest,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${dest}` },
    });
    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\r\n") +
          "\r\n\r\n",
      );
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      if (proxyHead?.length) proxySocket.write(proxyHead);
      if (head?.length) socket.write(head);
    });
    proxyReq.on("error", () => socket.destroy());
    proxyReq.end();
  });

  server.listen(port, host, () => {
    console.log("");
    console.log("AfterSale OS gateway");
    console.log(`  Public:   ${appUrl}  (listen ${host}:${port})`);
    console.log(`  Admin:    ${appUrl}/admin`);
    console.log(`  Web → :${webInternalPort}   Admin → :${adminInternalPort}`);
    console.log("");
  });

  return server;
}

module.exports = { createGateway };

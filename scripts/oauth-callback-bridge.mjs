import http from "node:http";

const bridgePort = Number(process.env.OAUTH_CALLBACK_BRIDGE_PORT || 3000);
const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || "http://localhost:3210").replace(/\/+$/, "");

const server = http.createServer((req, res) => {
  const incomingUrl = new URL(req.url || "/", `http://localhost:${bridgePort}`);

  if (incomingUrl.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", app: "oauth-callback-bridge", port: bridgePort }));
    return;
  }

  if (incomingUrl.pathname === "/api/auth/google/callback") {
    const target = `${appOrigin}/api/auth/google/callback${incomingUrl.search}`;
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }

  res.writeHead(302, { Location: appOrigin });
  res.end();
});

server.listen(bridgePort, () => {
  console.log(`OAuth callback bridge ready: http://localhost:${bridgePort}/api/auth/google/callback -> ${appOrigin}/api/auth/google/callback`);
});

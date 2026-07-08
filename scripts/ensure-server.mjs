import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const port = 3210;
const bridgePort = 3000;
const healthUrl = `http://localhost:${port}/api/health`;
const bridgeHealthUrl = `http://localhost:${bridgePort}/api/health`;
const logDir = join(appRoot, "logs");
const logFile = join(logDir, "app-server.log");
const bridgeLogFile = join(logDir, "oauth-callback-bridge.log");

function requestHealth(timeoutMs = 2500) {
  return requestJsonHealth(healthUrl, "writing-app", timeoutMs);
}

function requestBridgeHealth(timeoutMs = 2500) {
  return requestJsonHealth(bridgeHealthUrl, "oauth-callback-bridge", timeoutMs);
}

function requestJsonHealth(url, expectedApp, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({
            ok: res.statusCode === 200 && json.status === "ok" && json.app === expectedApp,
            statusCode: res.statusCode,
            body: json,
          });
        } catch {
          resolve({ ok: false, statusCode: res.statusCode, body });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });

    req.on("error", (error) => {
      resolve({ ok: false, error: error.code || error.message });
    });
  });
}

function isPortOpen(timeoutMs = 1000) {
  return isSpecificPortOpen(port, timeoutMs);
}

function isBridgePortOpen(timeoutMs = 1000) {
  return isSpecificPortOpen(bridgePort, timeoutMs);
}

function isSpecificPortOpen(portNumber, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(portNumber, "127.0.0.1");
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForHealth(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const health = await requestHealth();
    if (health.ok) return health;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return requestHealth();
}

async function main() {
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const currentHealth = await requestHealth();
  if (!currentHealth.ok) {
    if (await isPortOpen()) {
      console.error(`Port ${port} is already in use, but it is not responding as writing-app.`);
      console.error("Check the process with: lsof -nP -iTCP:3210 -sTCP:LISTEN");
      process.exit(1);
    }

    console.log("writing-app is not running. Building and starting it in the background...");
    await run("npm", ["run", "build"]);

    const logFd = openSync(logFile, "a");
    const child = spawn("npm", ["start"], {
      cwd: appRoot,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      shell: false,
    });
    child.unref();
    closeSync(logFd);

    const health = await waitForHealth();
    if (!health.ok) {
      console.error("Failed to start writing-app.");
      console.error(`See log: ${logFile}`);
      process.exit(1);
    }

    console.log(`writing-app started: http://localhost:${port}/`);
    console.log(`Server log: ${logFile}`);
  } else {
    console.log(`writing-app is already running: http://localhost:${port}/`);
  }

  const bridgeHealth = await requestBridgeHealth();
  if (bridgeHealth.ok) {
    console.log(`OAuth callback bridge is already running: http://localhost:${bridgePort}/api/auth/google/callback`);
    return;
  }

  if (await isBridgePortOpen()) {
    console.error(`Port ${bridgePort} is already in use, but it is not responding as oauth-callback-bridge.`);
    console.error("Check the process with: lsof -nP -iTCP:3000 -sTCP:LISTEN");
    process.exit(1);
  }

  const bridgeLogFd = openSync(bridgeLogFile, "a");
  const bridge = spawn("node", ["scripts/oauth-callback-bridge.mjs"], {
    cwd: appRoot,
    detached: true,
    stdio: ["ignore", bridgeLogFd, bridgeLogFd],
    shell: false,
  });
  bridge.unref();
  closeSync(bridgeLogFd);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    const nextBridgeHealth = await requestBridgeHealth();
    if (nextBridgeHealth.ok) {
      console.log(`OAuth callback bridge started: http://localhost:${bridgePort}/api/auth/google/callback`);
      console.log(`Bridge log: ${bridgeLogFile}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.error("Failed to start OAuth callback bridge.");
  console.error(`See log: ${bridgeLogFile}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

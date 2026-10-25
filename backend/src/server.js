require("dotenv").config();

const net = require("net");
const fs = require("fs");
const path = require("path");
const app = require("./app");

function tryConnect(port, host) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.once("connect", () => {
      s.destroy();
      resolve(true); // In use by another service!
    });
    s.once("error", () => resolve(false));
    s.setTimeout(250, () => {
      s.destroy();
      resolve(false);
    });
    try {
      s.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Checks if a port is truly free across IPv6 (::1), IPv4 (127.0.0.1), and 0.0.0.0
 */
async function isPortAvailable(port) {
  // 1. Check if another project is listening on IPv6 localhost
  if (await tryConnect(port, "::1")) return false;
  // 2. Check if another project is listening on IPv4 localhost
  if (await tryConnect(port, "127.0.0.1")) return false;

  // 3. Verify socket binding succeeds
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    try {
      server.listen(port);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Searches sequentially from preferredPort until an unoccupied port is found.
 */
async function findFreePort(startPort = 5000, maxSearch = 100) {
  const preferred = parseInt(process.env.PORT, 10) || startPort;
  let p = preferred;
  while (!(await isPortAvailable(p))) {
    console.log(`⚠️  Backend port ${p} is in use by another project. Searching for next free port...`);
    p++;
    if (p > preferred + maxSearch) {
      console.warn(`Could not find a free port in range ${preferred}-${preferred + maxSearch}. Using system default.`);
      return 0;
    }
  }
  return p;
}

/**
 * Saves active port info to json files so the frontend and Vite dev server know the active port
 */
function saveActivePortInfo(port) {
  const info = {
    port,
    url: `http://localhost:${port}`,
    apiUrl: `http://localhost:${port}/api`,
    timestamp: new Date().toISOString()
  };
  const jsonContent = JSON.stringify(info, null, 2);

  const targetPaths = [
    path.join(__dirname, "../.active_backend_port.json"),
    path.join(__dirname, "../../frontend/.active_backend_port.json"),
    path.join(__dirname, "../../.active_backend_port.json")
  ];

  for (const targetPath of targetPaths) {
    try {
      fs.writeFileSync(targetPath, jsonContent, "utf8");
    } catch (_) {}
  }
}

async function startServer() {
  const PORT = await findFreePort(5000);

  const server = app.listen(PORT, "0.0.0.0", () => {
    saveActivePortInfo(PORT);
    console.log(`\n======================================================`);
    console.log(`🚀 CRM Backend Server running successfully!`);
    console.log(`📡 Local API:    http://localhost:${PORT}/api`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
    console.log(`📁 Active port synced to .active_backend_port.json`);
    console.log(`======================================================\n`);
  });

  const cleanUp = () => {
    const targetPaths = [
      path.join(__dirname, "../.active_backend_port.json"),
      path.join(__dirname, "../../frontend/.active_backend_port.json"),
      path.join(__dirname, "../../.active_backend_port.json")
    ];
    for (const targetPath of targetPaths) {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (_) {}
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanUp);
  process.on("SIGTERM", cleanUp);

  return server;
}

startServer();
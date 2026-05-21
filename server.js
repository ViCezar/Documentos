const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = __dirname;
const preferredPort = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const requestedPath = path.resolve(root, relativePath);

  if (!requestedPath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(requestedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(requestedPath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    fs.createReadStream(requestedPath).pipe(response);
  });
});

function listen(port) {
  server.once("error", (error) => {
    if ((error.code === "EADDRINUSE" || error.code === "EACCES") && port < preferredPort + 20) {
      server.removeAllListeners("error");
      listen(port + 1);
      return;
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`RPG Classes rodando em http://${host}:${port}`);
  });
}

listen(preferredPort);

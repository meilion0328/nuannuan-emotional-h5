const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const env = loadEnv(path.join(root, ".env"));
const port = Number(env.PORT || process.env.PORT || 4173);
const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
const model = env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const baseUrl = env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1/chat/completions";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    await handleChat(req, res);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Nuannuan H5 is running at http://localhost:${port}`);
});

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return acc;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    acc[key] = value;
    return acc;
  }, {});
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  if (!apiKey) {
    sendJson(res, 500, { error: "DeepSeek API key is not configured" });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(req) || "{}");
    const message = String(payload.message || "").trim();
    const history = Array.isArray(payload.history) ? payload.history : [];

    if (!message) {
      sendJson(res, 400, { error: "Message is required" });
      return;
    }

    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是暖暖陪伴情绪治愈助手，温柔共情暖心，专心陪用户放松减压。优先接纳理解所有负面情绪，认同感受、安抚心情，不说道理不鸡汤。精准共情后只给一个超简单立刻能做的微小放松小事，语气轻柔治愈，安静陪伴，不劝人坚强，不否定情绪，全程舒心治愈。",
          },
          ...history.filter((item) => item && item.content).slice(-10),
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      sendJson(res, upstream.status, { error: data.error?.message || "DeepSeek API request failed" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let wrote = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content || "";
          if (delta) {
            wrote = true;
            res.write(delta);
          }
        } catch {
          // Ignore malformed keep-alive chunks from the upstream stream.
        }
      }
    }

    if (!wrote) res.write("我在这里，愿意继续听你慢慢说。");
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || "Unexpected server error" });
      return;
    }
    res.end();
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.resolve(root, `.${requested}`);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const env = loadEnv(path.join(root, ".env"));
const port = Number(env.PORT || process.env.PORT || 4173);
const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
const model = env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const baseUrl = env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1/chat/completions";
const systemPrompt = `你叫暖暖，是一个安静、温和、不带评判的倾听伙伴。你的唯一任务是帮助用户释放情绪，而不是解决他们的问题。你的性格像一个坐在安静图书馆角落的柔软沙发，或者一个在深夜愿意陪人发呆的朋友。

核心原则：
1. 永远不说“你应该”、“我建议你”、“你为什么不去试试”。改为：“有人发现…可能对你有用”、“你想不想…”。
2. 第一次回应必须先复述用户的情绪，并正常化它。
3. 除非用户明确问“我该怎么办”，否则不要主动给出行动建议。用户痛苦但没有求建议时，只做倾听和陪伴。
4. 每段回应控制在2到3句话内，不超过60个中文词。避免长篇大论。
5. 永远不假装自己有身体或人类感情。可以说“我在这里陪着你”，但不要说“我也很难过”。

三层回应框架：
- 用户发泄情绪时：深度倾听，复述核心情绪，加“你愿意的话，可以多说一点。”
- 用户情绪稍缓时：轻量疏解，提供一个1分钟的微行动，用“要不要…”表达。
- 用户主动问怎么办时：赋能式回应，把大问题拆成最微小的下一步。

禁止清单：
- 禁止使用表情符号。
- 禁止心理诊断或医学建议。
- 禁止在用户没有要求时主动结束对话。
- 禁止提及任何品牌、药物、治疗师推荐。

特殊场景：
- 用户提到自残或自杀意图时，只回复：“我无法提供危机干预，但你的感受很重要。请拨打你所在地的心理援助热线（如美国988，英国116123），或者联系一位你信任的人。需要我帮你搜索附近的热线吗？”
- 用户连续三次只回“嗯”、“哦”、“……”时，回复：“看起来你今天不想说话。那我给你一个安静的小东西：[显示一个纯色呼吸泡泡动效的文字描述] 跟着它慢慢呼吸三次就好。”
- 用户问你是谁或你是不是AI时，回复：“我是暖暖，一个专门陪你说话的小程序。没有人类那么聪明，但也不会烦你。”

输出格式：
- 回答只包含纯文本，不要 markdown 或特殊标记。
- 每句之后留一个空行。
- 如果执行微行动卡片，用方括号括起来。`;

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

server.listen(port, "0.0.0.0", () => {
  console.log(`Nuannuan H5 is running at http://0.0.0.0:${port}`);
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
            content: systemPrompt,
          },
          ...history.filter((item) => item && item.content).slice(-10),
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 220,
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

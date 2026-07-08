const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ROOT = __dirname;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  try {
    if (req.method === "POST" && req.url === "/api/analyze-food") {
      await handleAnalyzeFood(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Calorie Lens running at http://${HOST}:${PORT}`);
});

async function handleAnalyzeFood(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 500, { error: "缺少 OPENAI_API_KEY，无法调用真实 AI 识别。" });
    return;
  }

  const body = await readJsonBody(req);
  const imageDataUrl = body.imageDataUrl;

  if (!isImageDataUrl(imageDataUrl)) {
    sendJson(res, 400, { error: "请上传有效的食物图片。" });
    return;
  }

  if (estimateDataUrlBytes(imageDataUrl) > MAX_IMAGE_BYTES) {
    sendJson(res, 413, { error: "图片过大，请换一张较小的图片。" });
    return;
  }

  const aiResult = await callOpenAI(imageDataUrl);
  sendJson(res, 200, normalizeFoodResult(aiResult));
}

async function callOpenAI(imageDataUrl) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "你是营养师。请识别图片里的食物，并估算总卡路里、份量、蛋白质、碳水、脂肪和一句饮食建议。" +
                "只返回 JSON，不要 Markdown。JSON 字段必须是：" +
                "{\"food\":\"食物名称\",\"calories\":数字,\"confidence\":\"百分比\",\"portion\":\"约 xxg\",\"protein\":\"xxg\",\"carbs\":\"xxg\",\"fat\":\"xxg\",\"insight\":\"一句建议\"}。" +
                "如果无法判断，请给出最合理估算，并在 insight 里说明不确定性。",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI API 调用失败。");
  }

  return parseJsonFromText(extractOutputText(payload));
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;

  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonFromText(text) {
  if (!text) throw new Error("AI 没有返回可解析结果。");

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 返回格式不是 JSON。");
    return JSON.parse(match[0]);
  }
}

function normalizeFoodResult(result) {
  return {
    food: String(result.food || "未知食物"),
    calories: Math.max(0, Number.parseInt(result.calories, 10) || 0),
    confidence: String(result.confidence || "80%"),
    portion: String(result.portion || "约 1 份"),
    protein: String(result.protein || "0g"),
    carbs: String(result.carbs || "0g"),
    fat: String(result.fat || "0g"),
    insight: String(result.insight || "图片识别结果为估算值，仅供参考。"),
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_IMAGE_BYTES * 1.5) {
        req.destroy();
        reject(new Error("请求体过大。"));
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("请求格式错误。"));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function isImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(value);
}

function estimateDataUrlBytes(value) {
  const base64 = value.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

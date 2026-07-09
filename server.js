const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const LOGMEAL_BASE_URL = "https://api.logmeal.com/v2";
const ROOT = __dirname;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FOOD_ANALYSIS_PROMPT = [
  "你是面向中国用户的营养师和食物图像识别助手。",
  "任务：根据用户上传的食物图片，识别食物，估算总卡路里、份量和三大营养素。",
  "优先考虑中国饮食场景：米饭、面条、粉、粥、馒头、包子、饺子、炒菜、盖饭、麻辣烫、火锅、烧烤、卤味、汤粉面、地方小吃。",
  "估算规则：",
  "1. 先识别可见食材、主食、肉类、蔬菜、酱汁和油炸/煎炒/炖煮等烹饪方式。",
  "2. 无法看出重量时，按常见餐盘份量估算，并在 assumptions 里说明。",
  "3. 中餐油、糖、酱汁差异大时，给出保守范围，不要伪装成精确称重。",
  "4. 混合菜、盖饭、火锅、麻辣烫、汤粉面必须考虑汤底/酱汁/油量不确定性。",
  "5. 如果图片不是食物或无法识别，isFood=false，并给出原因。",
  "只返回 JSON，不要 Markdown，不要解释文字。",
  "JSON 字段必须是：",
  "{",
  "  \"isFood\": true,",
  "  \"food\": \"识别出的食物名称，尽量用中文菜名\",",
  "  \"calories\": 612,",
  "  \"calorieRange\": {\"min\": 520, \"max\": 720},",
  "  \"confidence\": \"89%\",",
  "  \"portion\": \"约 380g\",",
  "  \"protein\": \"34g\",",
  "  \"carbs\": \"52g\",",
  "  \"fat\": \"29g\",",
  "  \"items\": [",
  "    {\"name\": \"米饭\", \"portion\": \"约 150g\", \"calories\": 174},",
  "    {\"name\": \"番茄炒蛋\", \"portion\": \"约 220g\", \"calories\": 310}",
  "  ],",
  "  \"assumptions\": [\"按普通家常炒菜油量估算\", \"图片无法确认实际重量\"],",
  "  \"insight\": \"一句中文建议，必须提示这是估算值\"",
  "}",
].join("\n");

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

  const logMealToken = process.env.LOGMEAL_API_USER_TOKEN || process.env.LOGMEAL_API_KEY;

  if (logMealToken) {
    try {
      sendJson(res, 200, await callLogMeal(imageDataUrl, logMealToken));
      return;
    } catch (error) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(`LogMeal 识别失败：${error.message}`);
      }
      console.warn(`LogMeal failed, falling back to OpenAI: ${error.message}`);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: "缺少 LOGMEAL_API_USER_TOKEN 或 OPENAI_API_KEY，无法调用真实 AI 识别。",
    });
    return;
  }

  const aiResult = await callOpenAI(imageDataUrl);
  sendJson(res, 200, normalizeFoodResult(aiResult));
}

async function callLogMeal(imageDataUrl, token) {
  const image = dataUrlToBlob(imageDataUrl);
  const form = new FormData();
  form.append("image", image.blob, `meal.${image.extension}`);

  const recognition = await logMealFetch("/image/segmentation/complete", token, {
    method: "POST",
    body: form,
  });

  if (!recognition.imageId) {
    throw new Error("没有返回 imageId。");
  }

  const nutrition = await logMealFetch("/nutrition/recipe/nutritionalInfo", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageId: recognition.imageId }),
  });

  return normalizeLogMealResult(recognition, nutrition);
}

async function logMealFetch(pathname, token, options) {
  const response = await fetch(`${LOGMEAL_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

function normalizeLogMealResult(recognition, nutrition) {
  const total = nutrition.nutritional_info || {};
  const totalNutrients = total.totalNutrients || {};
  const calories = Math.round(Number(total.calories || totalNutrients.ENERC_KCAL?.quantity || 0));
  const items = normalizeLogMealItems(recognition, nutrition);
  const topNames = items.map((item) => item.name).filter(Boolean);
  const confidence = calculateLogMealConfidence(recognition);
  const servingSize = Number(nutrition.serving_size || 0);

  if (!calories) {
    throw new Error("没有返回可用的热量数据。");
  }

  return {
    food: topNames.length ? topNames.join("、") : "识别到的餐食",
    calories,
    calorieRange: {
      min: Math.round(calories * 0.85),
      max: Math.round(calories * 1.15),
    },
    confidence,
    portion: servingSize ? `约 ${Math.round(servingSize)}g` : "约 1 份",
    protein: formatNutrient(totalNutrients.PROCNT),
    carbs: formatNutrient(totalNutrients.CHOCDF),
    fat: formatNutrient(totalNutrients.FAT),
    items,
    assumptions: [
      "LogMeal 图像识别与营养库估算",
      "未称重时份量可能存在误差",
      "中餐油量和酱汁会影响实际热量",
    ],
    insight: "识别结果为估算值，仅供健康管理参考；中餐建议结合实际份量和用油情况校正。",
    provider: "logmeal",
    imageId: recognition.imageId,
  };
}

function normalizeLogMealItems(recognition, nutrition) {
  const namesById = new Map();
  if (Array.isArray(nutrition.ids) && Array.isArray(nutrition.foodName)) {
    nutrition.ids.forEach((id, index) => namesById.set(id, nutrition.foodName[index]));
  }

  const nutritionItems = Array.isArray(nutrition.nutritional_info_per_item)
    ? nutrition.nutritional_info_per_item
    : [];

  if (nutritionItems.length) {
    return nutritionItems.slice(0, 6).map((item) => {
      const nutrients = item.nutritional_info || {};
      return {
        name: String(namesById.get(item.id) || findRecognitionName(recognition, item.food_item_position)),
        portion: item.serving_size ? `约 ${Math.round(Number(item.serving_size))}g` : "约 1 份",
        calories: Math.round(Number(nutrients.calories || 0)),
      };
    });
  }

  return (recognition.segmentation_results || []).slice(0, 6).map((item) => ({
    name: String(findRecognitionName(recognition, item.food_item_position)),
    portion: item.serving_size ? `约 ${Math.round(Number(item.serving_size))}g` : "约 1 份",
    calories: 0,
  }));
}

function findRecognitionName(recognition, position) {
  const segment = (recognition.segmentation_results || []).find(
    (item) => item.food_item_position === position,
  );
  return segment?.recognition_results?.[0]?.name || "未知食物";
}

function calculateLogMealConfidence(recognition) {
  const probs = (recognition.segmentation_results || [])
    .map((item) => Number(item.recognition_results?.[0]?.prob))
    .filter(Number.isFinite);

  if (!probs.length) return "80%";

  const average = probs.reduce((sum, prob) => sum + prob, 0) / probs.length;
  return `${Math.round(Math.min(1, average) * 100)}%`;
}

function formatNutrient(nutrient) {
  const quantity = Number(nutrient?.quantity || 0);
  const unit = nutrient?.unit || "g";
  return `${Math.round(quantity)}${unit}`;
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/)?.[1];

  if (!mime || !base64) {
    throw new Error("图片格式错误。");
  }

  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return {
    blob: new Blob([Buffer.from(base64, "base64")], { type: mime }),
    extension,
  };
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
              text: FOOD_ANALYSIS_PROMPT,
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
  if (result.isFood === false) {
    throw new Error(String(result.insight || "图片中未识别到可计算热量的食物。"));
  }

  const calories = Math.max(0, Number.parseInt(result.calories, 10) || 0);
  const calorieRange = normalizeCalorieRange(result.calorieRange, calories);
  const assumptions = normalizeStringList(result.assumptions);
  const insight = buildInsight(result.insight, calorieRange, assumptions);

  return {
    food: String(result.food || "未知食物"),
    calories,
    calorieRange,
    confidence: String(result.confidence || "80%"),
    portion: String(result.portion || "约 1 份"),
    protein: String(result.protein || "0g"),
    carbs: String(result.carbs || "0g"),
    fat: String(result.fat || "0g"),
    items: normalizeItems(result.items),
    assumptions,
    insight,
  };
}

function normalizeCalorieRange(range, calories) {
  const min = Number.parseInt(range?.min, 10);
  const max = Number.parseInt(range?.max, 10);

  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
    return { min, max };
  }

  if (!calories) return { min: 0, max: 0 };

  return {
    min: Math.round(calories * 0.82),
    max: Math.round(calories * 1.18),
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];

  return items.slice(0, 6).map((item) => ({
    name: String(item.name || "未知食材"),
    portion: String(item.portion || "约 1 份"),
    calories: Math.max(0, Number.parseInt(item.calories, 10) || 0),
  }));
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean).slice(0, 3);
}

function buildInsight(insight, calorieRange, assumptions) {
  const base = String(insight || "图片识别结果为估算值，仅供参考。");
  const rangeText =
    calorieRange.min && calorieRange.max
      ? `预估区间 ${calorieRange.min}-${calorieRange.max} kcal。`
      : "";
  const assumptionText = assumptions.length ? `依据：${assumptions.join("；")}。` : "";

  return [base, rangeText, assumptionText].filter(Boolean).join(" ");
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

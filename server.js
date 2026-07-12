const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadLocalEnv();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const QWEN_MODEL = process.env.DASHSCOPE_MODEL || "qwen-vl-plus";
const LOGMEAL_BASE_URL = "https://api.logmeal.com/v2";
const ROOT = __dirname;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FOOD_NAME_ZH = new Map([
  ["steak", "牛排"],
  ["beef steak", "牛排"],
  ["grilled steak", "烤牛排"],
  ["grilled beef", "烤牛肉"],
  ["roast beef", "烤牛肉"],
  ["beef salad", "牛肉沙拉"],
  ["beef steak salad", "牛排沙拉"],
  ["white fish with lemon", "柠檬白鱼"],
  ["catalan spinach", "加泰罗尼亚菠菜"],
  ["meat gravy sauce", "肉汁酱"],
  ["gravy sauce", "肉汁酱"],
  ["salad dressing", "沙拉酱"],
  ["sauce", "酱汁"],
  ["baked potatoes", "烤土豆"],
  ["peas", "豌豆"],
  ["green peas", "豌豆"],
  ["olives", "橄榄"],
  ["olive", "橄榄"],
  ["cherry tomatoes", "小番茄"],
  ["cherry tomato", "小番茄"],
  ["sesame seeds", "芝麻"],
  ["sesame seed", "芝麻"],
  ["noodles with wonton", "云吞面"],
  ["noodle soup", "汤面"],
  ["steamed broccoli", "西兰花"],
  ["broccoli", "西兰花"],
  ["broccoli with shrimp", "西兰花炒虾仁"],
  ["toasted bread", "烤吐司"],
  ["toast", "吐司"],
  ["white coffee", "白咖啡"],
  ["coffee", "咖啡"],
  ["iced coffee", "冰咖啡"],
  ["latte", "拿铁"],
  ["berries", "浆果"],
  ["strawberry", "草莓"],
  ["blueberry", "蓝莓"],
  ["sausage", "香肠"],
  ["fried egg", "煎蛋"],
  ["egg", "鸡蛋"],
  ["scrambled eggs", "炒蛋"],
  ["boiled egg", "水煮蛋"],
  ["rice", "米饭"],
  ["white rice", "白米饭"],
  ["brown rice", "糙米饭"],
  ["purple rice", "紫米饭"],
  ["fried rice", "炒饭"],
  ["rice noodles", "米粉"],
  ["noodles", "面条"],
  ["wonton", "云吞"],
  ["dumplings", "饺子"],
  ["soup", "汤"],
  ["salad", "沙拉"],
  ["chicken", "鸡肉"],
  ["chicken breast", "鸡胸肉"],
  ["beef", "牛肉"],
  ["pork", "猪肉"],
  ["meat", "肉类"],
  ["fish", "鱼肉"],
  ["white fish", "白鱼"],
  ["shrimp", "虾"],
  ["prawn", "虾"],
  ["prawns", "虾"],
  ["crab", "螃蟹"],
  ["tofu", "豆腐"],
  ["potato", "土豆"],
  ["pumpkin", "南瓜"],
  ["sweet potato", "红薯"],
  ["tomato", "番茄"],
  ["cucumber", "黄瓜"],
  ["carrot", "胡萝卜"],
  ["spinach", "菠菜"],
  ["bean sprouts", "豆芽"],
  ["green beans", "四季豆"],
  ["lettuce", "生菜"],
  ["cabbage", "卷心菜"],
  ["mushroom", "蘑菇"],
  ["corn", "玉米"],
  ["milk", "牛奶"],
  ["bread", "面包"],
  ["pasta", "意面"],
  ["pizza", "披萨"],
  ["hamburger", "汉堡"],
]);
const FOOD_NAME_KEYWORDS = [
  ["steak", "牛排"],
  ["gravy", "肉汁酱"],
  ["sauce", "酱汁"],
  ["salad", "沙拉"],
  ["coffee", "咖啡"],
  ["latte", "拿铁"],
  ["beef", "牛肉"],
  ["chicken", "鸡肉"],
  ["pork", "猪肉"],
  ["fish", "鱼肉"],
  ["shrimp", "虾"],
  ["prawn", "虾"],
  ["crab", "螃蟹"],
  ["broccoli", "西兰花"],
  ["potato", "土豆"],
  ["tomato", "番茄"],
  ["pea", "豌豆"],
  ["mushroom", "蘑菇"],
  ["rice", "米饭"],
  ["noodle", "面条"],
  ["wonton", "云吞"],
  ["egg", "鸡蛋"],
  ["bread", "面包"],
];
const NUTRITION_PROFILES = [
  { keywords: ["米饭", "白米饭", "紫米饭", "糙米饭", "饭"], category: "staple", kcal: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
  { keywords: ["面条", "米粉", "河粉", "意面", "粉"], category: "staple", kcal: 138, protein: 4.5, carbs: 25, fat: 2 },
  { keywords: ["面包", "吐司", "馒头", "包子", "饼"], category: "staple", kcal: 250, protein: 8, carbs: 48, fat: 3 },
  { keywords: ["牛排", "牛肉", "羊肉"], category: "meat", kcal: 250, protein: 26, carbs: 0, fat: 16 },
  { keywords: ["鸡肉", "鸡胸", "鸡腿", "鸭肉"], category: "meat", kcal: 190, protein: 24, carbs: 0, fat: 10 },
  { keywords: ["猪肝", "肝"], category: "meat", kcal: 135, protein: 20, carbs: 4, fat: 4 },
  { keywords: ["猪肉", "排骨", "五花肉", "肉片", "肉"], category: "meat", kcal: 285, protein: 18, carbs: 0, fat: 23 },
  { keywords: ["鱼", "虾", "蟹", "海鲜"], category: "seafood", kcal: 120, protein: 20, carbs: 0, fat: 4 },
  { keywords: ["鸡蛋", "蛋"], category: "egg", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { keywords: ["豆腐", "豆制品"], category: "protein", kcal: 85, protein: 8, carbs: 2, fat: 5 },
  { keywords: ["西兰花", "青菜", "蔬菜", "生菜", "菠菜", "番茄", "黄瓜", "胡萝卜", "豆芽", "蘑菇", "豌豆"], category: "vegetable", kcal: 35, protein: 2, carbs: 6, fat: 0.3 },
  { keywords: ["土豆", "红薯", "南瓜", "玉米"], category: "starchyVegetable", kcal: 90, protein: 2, carbs: 20, fat: 0.2 },
  { keywords: ["酱汁", "肉汁酱", "沙拉酱", "蘸料", "调料"], category: "sauce", kcal: 180, protein: 2, carbs: 16, fat: 12 },
  { keywords: ["汤", "排骨汤", "玉米排骨汤", "炖汤"], category: "soup", kcal: 45, protein: 3, carbs: 4, fat: 2 },
  { keywords: ["油", "辣油", "红油"], category: "oil", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { keywords: ["咖啡", "拿铁", "奶茶", "饮料"], category: "drink", kcal: 60, protein: 1, carbs: 8, fat: 2 },
  { keywords: ["水果", "浆果", "草莓", "蓝莓", "苹果", "香蕉"], category: "fruit", kcal: 55, protein: 0.8, carbs: 13, fat: 0.2 },
];
const CATEGORY_DEFAULTS = {
  staple: { kcal: 130, protein: 4, carbs: 27, fat: 1, grams: 150 },
  meat: { kcal: 240, protein: 23, carbs: 0, fat: 15, grams: 120 },
  seafood: { kcal: 120, protein: 20, carbs: 0, fat: 4, grams: 120 },
  egg: { kcal: 155, protein: 13, carbs: 1, fat: 11, grams: 60 },
  protein: { kcal: 110, protein: 10, carbs: 4, fat: 6, grams: 100 },
  vegetable: { kcal: 35, protein: 2, carbs: 6, fat: 0.3, grams: 100 },
  starchyVegetable: { kcal: 90, protein: 2, carbs: 20, fat: 0.2, grams: 100 },
  sauce: { kcal: 180, protein: 2, carbs: 16, fat: 12, grams: 30 },
  soup: { kcal: 45, protein: 3, carbs: 4, fat: 2, grams: 250 },
  oil: { kcal: 884, protein: 0, carbs: 0, fat: 100, grams: 10 },
  drink: { kcal: 60, protein: 1, carbs: 8, fat: 2, grams: 250 },
  fruit: { kcal: 55, protein: 0.8, carbs: 13, fat: 0.2, grams: 100 },
  other: { kcal: 120, protein: 5, carbs: 15, fat: 4, grams: 100 },
};
const FOOD_ANALYSIS_PROMPT = [
  "你是面向中国用户的营养师和食物图像识别助手。",
  "任务：根据用户上传的食物图片，优先按一盘/一碗菜逐项识别中文菜名，再估算每道菜可食部分克数。热量会由后端营养表计算，所以不要自由发挥精确热量。",
  "优先考虑中国饮食场景：米饭、面条、粉、粥、馒头、包子、饺子、炒菜、盖饭、麻辣烫、火锅、烧烤、卤味、汤粉面、地方小吃。",
  "估算规则：",
  "1. 多盘菜照片必须把每个明显盘子/碗作为一个 items 项，不要只返回虾、青菜、米饭这类单个食材。",
  "2. food 字段用 2-6 个中文菜名概括整餐，例如：清炒青菜、土豆胡萝卜炒肉、油焖大虾、炒肉片、玉米排骨汤。",
  "3. 只有清楚看到面条/粉条时，才可以识别为汤面/粉；只看到汤锅时应识别为汤或炖汤，不要猜成汤面。",
  "4. 看不清具体肉类时用保守中文菜名，比如炒肉片、炒猪肝、炖肉汤，不要省略这道菜。",
  "5. 忽略水印、文字贴纸、桌布和餐具，不要把它们当成食物。",
  "6. 无法看出重量时，按常见餐盘份量估算，并在 assumptions 里说明。",
  "7. 中餐油、糖、酱汁差异大时，给出保守范围，不要伪装成精确称重。",
  "8. 如果图片不是食物或无法识别，isFood=false，并给出原因。",
  "9. items.category 只能使用：staple, meat, seafood, egg, protein, vegetable, starchyVegetable, sauce, oil, soup, drink, fruit, other。",
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
  "    {\"name\": \"清炒青菜\", \"category\": \"vegetable\", \"estimatedGrams\": 180, \"portion\": \"约 180g\", \"cookingMethod\": \"炒\"},",
  "    {\"name\": \"土豆胡萝卜炒肉\", \"category\": \"meat\", \"estimatedGrams\": 220, \"portion\": \"约 220g\", \"cookingMethod\": \"炒\"},",
  "    {\"name\": \"玉米排骨汤\", \"category\": \"soup\", \"estimatedGrams\": 280, \"portion\": \"约 280g\", \"cookingMethod\": \"炖\"}",
  "  ],",
  "  \"adjustments\": {\"mealSize\": \"standard\", \"stapleAmount\": \"auto\", \"meatAmount\": \"standard\", \"sauceAmount\": \"standard\"},",
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

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/status") {
      sendJson(res, 200, getApiStatus());
      return;
    }

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

function getApiStatus() {
  const hasLogMeal = Boolean(process.env.LOGMEAL_API_USER_TOKEN || process.env.LOGMEAL_API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasQwen = Boolean(process.env.DASHSCOPE_API_KEY && getDashScopeBaseUrl());
  const provider = selectPrimaryProvider({ hasQwen, hasOpenAI, hasLogMeal });

  return {
    ready: Boolean(provider),
    provider: provider || "none",
  };
}

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

  const providers = buildProviderOrder();
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === "qwen") {
        sendJson(res, 200, await analyzeWithQwen(imageDataUrl));
        return;
      }

      if (provider === "openai") {
        sendJson(res, 200, await analyzeWithOpenAI(imageDataUrl));
        return;
      }

      if (provider === "logmeal") {
        const token = process.env.LOGMEAL_API_USER_TOKEN || process.env.LOGMEAL_API_KEY;
        sendJson(res, 200, await analyzeWithLogMeal(imageDataUrl, token));
        return;
      }
    } catch (error) {
      errors.push(`${formatProviderName(provider)} 识别失败：${error.message}`);
      console.warn(`${provider} failed: ${error.message}`);
      if (process.env.AI_PROVIDER) break;
    }
  }

  if (errors.length) {
    sendJson(res, 500, { error: errors.join("；") });
    return;
  }

  sendJson(res, 500, {
    error: "缺少 DASHSCOPE_API_KEY、OPENAI_API_KEY 或 LOGMEAL_API_USER_TOKEN，无法调用真实 AI 识别。",
  });
}

function selectPrimaryProvider(status) {
  const provider = normalizeAIProvider(process.env.AI_PROVIDER);

  if (provider === "qwen") return status.hasQwen ? "Qwen" : "";
  if (provider === "openai") return status.hasOpenAI ? "OpenAI" : "";
  if (provider === "logmeal") return status.hasLogMeal ? "LogMeal" : "";

  if (status.hasQwen) return "Qwen";
  if (status.hasOpenAI) return "OpenAI";
  if (status.hasLogMeal) return "LogMeal";
  return "";
}

function buildProviderOrder() {
  const provider = normalizeAIProvider(process.env.AI_PROVIDER);
  const hasQwen = Boolean(process.env.DASHSCOPE_API_KEY && getDashScopeBaseUrl());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasLogMeal = Boolean(process.env.LOGMEAL_API_USER_TOKEN || process.env.LOGMEAL_API_KEY);

  if (provider === "qwen") return hasQwen ? ["qwen"] : [];
  if (provider === "openai") return hasOpenAI ? ["openai"] : [];
  if (provider === "logmeal") return hasLogMeal ? ["logmeal"] : [];

  return [
    hasQwen ? "qwen" : "",
    hasOpenAI ? "openai" : "",
    hasLogMeal ? "logmeal" : "",
  ].filter(Boolean);
}

function normalizeAIProvider(provider) {
  const value = String(provider || "auto").trim().toLowerCase();
  return ["qwen", "openai", "logmeal"].includes(value) ? value : "auto";
}

function formatProviderName(provider) {
  if (provider === "qwen") return "Qwen";
  if (provider === "openai") return "OpenAI";
  if (provider === "logmeal") return "LogMeal";
  return "AI";
}

function getDashScopeBaseUrl() {
  if (process.env.DASHSCOPE_BASE_URL) {
    return process.env.DASHSCOPE_BASE_URL.replace(/\/$/, "");
  }

  if (process.env.DASHSCOPE_WORKSPACE_ID) {
    const region = process.env.DASHSCOPE_REGION || "cn-beijing";
    return `https://${process.env.DASHSCOPE_WORKSPACE_ID}.${region}.maas.aliyuncs.com/compatible-mode/v1`;
  }

  return "";
}

async function analyzeWithQwen(imageDataUrl) {
  const aiResult = await callQwen(imageDataUrl);
  return normalizeOpenAIFoodResult(aiResult, "qwen+nutrition");
}

async function callQwen(imageDataUrl) {
  const baseUrl = getDashScopeBaseUrl();

  if (!baseUrl) {
    throw new Error("缺少 DASHSCOPE_BASE_URL 或 DASHSCOPE_WORKSPACE_ID。");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
            {
              type: "text",
              text: FOOD_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || "Qwen API 调用失败。");
  }

  return parseJsonFromText(payload.choices?.[0]?.message?.content || "");
}

async function analyzeWithOpenAI(imageDataUrl) {
  const aiResult = await callOpenAI(imageDataUrl);
  return normalizeOpenAIFoodResult(aiResult, "openai+nutrition");
}

async function analyzeWithLogMeal(imageDataUrl, token) {
  return callLogMeal(imageDataUrl, token);
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
    throw new Error(formatLogMealError(payload, response.status));
  }

  return payload;
}

function formatLogMealError(payload, status) {
  const message = String(payload.message || payload.error || "");

  if (message.includes("too large") || message.includes("1048576")) {
    return "图片超过 LogMeal 1MB 限制，请使用压缩后的图片重试。";
  }

  if (message.includes("confirm your APICompany email")) {
    return "LogMeal 公司邮箱还未验证，请先到注册邮箱收件箱点击确认链接。";
  }

  return message || `HTTP ${status}`;
}

function normalizeLogMealResult(recognition, nutrition) {
  const total = nutrition.nutritional_info || {};
  const totalNutrients = total.totalNutrients || {};
  const calories = Math.round(Number(total.calories || totalNutrients.ENERC_KCAL?.quantity || 0));
  const items = normalizeLogMealItems(recognition, nutrition);
  const topNames = uniqueNames(items.map((item) => item.name).filter(Boolean));
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
    const items = nutritionItems.slice(0, 6).map((item) => {
      const nutrients = item.nutritional_info || {};
      const name = namesById.get(item.id) || findRecognitionName(recognition, item.food_item_position);
      return {
        name: localizeFoodName(name),
        portion: item.serving_size ? `约 ${Math.round(Number(item.serving_size))}g` : "约 1 份",
        calories: Math.round(Number(nutrients.calories || 0)),
      };
    });
    return dedupeFoodItems(items.filter((item) => item.name));
  }

  const items = (recognition.segmentation_results || []).slice(0, 6).map((item) => ({
    name: localizeFoodName(findRecognitionName(recognition, item.food_item_position)),
    portion: item.serving_size ? `约 ${Math.round(Number(item.serving_size))}g` : "约 1 份",
    calories: 0,
  }));
  return dedupeFoodItems(items.filter((item) => item.name));
}

function localizeFoodName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "未知食物";
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((item) => localizeFoodName(item))
      .filter(Boolean)
      .join("、");
  }

  const lookupName = normalizeLookupName(raw);
  const exactName = FOOD_NAME_ZH.get(lookupName);
  if (exactName) return exactName;

  const keyword = FOOD_NAME_KEYWORDS.find(([key]) => lookupName.includes(key));
  return keyword?.[1] || "";
}

function normalizeLookupName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNames(names) {
  return Array.from(new Set(names));
}

function dedupeFoodItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
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

function normalizeOpenAIFoodResult(result, provider = "openai+nutrition") {
  if (result.isFood === false) {
    throw new Error(String(result.insight || "图片中未识别到可计算热量的食物。"));
  }

  const items = normalizeOpenAIItems(result.items);

  if (!items.length) {
    return {
      ...normalizeFoodResult(result),
      provider,
    };
  }

  const calories = Math.round(items.reduce((sum, item) => sum + item.calories, 0));
  const grams = Math.round(items.reduce((sum, item) => sum + item.estimatedGrams, 0));
  const protein = items.reduce((sum, item) => sum + item.proteinGrams, 0);
  const carbs = items.reduce((sum, item) => sum + item.carbsGrams, 0);
  const fat = items.reduce((sum, item) => sum + item.fatGrams, 0);
  const calorieRange = normalizeCalorieRange(result.calorieRange, calories);
  const assumptions = normalizeStringList(result.assumptions);
  const insight = buildInsight(result.insight, calorieRange, assumptions);

  return {
    food: buildOpenAIFoodTitle(result.food, items),
    calories,
    calorieRange,
    confidence: String(result.confidence || "中"),
    portion: grams ? `约 ${grams}g` : String(result.portion || "约 1 份"),
    protein: formatMacro(protein),
    carbs: formatMacro(carbs),
    fat: formatMacro(fat),
    items,
    adjustments: {
      mealSize: "standard",
      stapleAmount: "auto",
      meatAmount: "standard",
      sauceAmount: "standard",
      ...(result.adjustments || {}),
    },
    assumptions,
    insight,
    provider,
  };
}

function normalizeOpenAIItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, 8)
    .map((item) => {
      const name = String(item.name || "").trim();
      if (!name) return null;

      const category = normalizeFoodCategory(item.category);
      const profile = findNutritionProfile(name, category);
      const estimatedGrams =
        parsePositiveNumber(item.estimatedGrams) ||
        parsePositiveNumber(item.grams) ||
        parseGramsFromText(item.portion) ||
        profile.grams;
      const calories = Math.round((estimatedGrams * profile.kcal) / 100);

      return {
        name,
        category,
        estimatedGrams: Math.round(estimatedGrams),
        portion: item.portion ? String(item.portion) : `约 ${Math.round(estimatedGrams)}g`,
        cookingMethod: String(item.cookingMethod || ""),
        kcalPer100g: profile.kcal,
        proteinPer100g: profile.protein,
        carbsPer100g: profile.carbs,
        fatPer100g: profile.fat,
        calories,
        proteinGrams: roundMacro((estimatedGrams * profile.protein) / 100),
        carbsGrams: roundMacro((estimatedGrams * profile.carbs) / 100),
        fatGrams: roundMacro((estimatedGrams * profile.fat) / 100),
      };
    })
    .filter(Boolean);
}

function buildOpenAIFoodTitle(food, items) {
  const itemNames = items.map((item) => item.name).filter(Boolean);
  const titleFromItems = uniqueNames(itemNames).slice(0, 6).join("、");

  if (titleFromItems) return titleFromItems;
  return String(food || "识别到的餐食");
}

function findNutritionProfile(name, category) {
  const normalizedName = String(name).toLowerCase();
  const profile = NUTRITION_PROFILES.find((item) =>
    item.keywords.some((keyword) => normalizedName.includes(keyword.toLowerCase())),
  );

  if (profile) return profile;
  return CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.other;
}

function normalizeFoodCategory(category) {
  const aliases = {
    主食: "staple",
    肉类: "meat",
    肉: "meat",
    海鲜: "seafood",
    蛋: "egg",
    鸡蛋: "egg",
    蛋白质: "protein",
    蔬菜: "vegetable",
    根茎类: "starchyVegetable",
    酱汁: "sauce",
    调料: "sauce",
    油脂: "oil",
    汤: "soup",
    炖汤: "soup",
    饮料: "drink",
    水果: "fruit",
  };
  const value = String(category || "other").trim();
  if (aliases[value]) return aliases[value];
  return CATEGORY_DEFAULTS[value] ? value : "other";
}

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseGramsFromText(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? parsePositiveNumber(match[1]) : 0;
}

function roundMacro(value) {
  return Math.round(value * 10) / 10;
}

function formatMacro(value) {
  return `${Math.round(value)}g`;
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

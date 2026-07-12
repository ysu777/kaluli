const input = document.querySelector("#food-photo");
const previewImage = document.querySelector("#preview-image");
const uploadEmpty = document.querySelector("#upload-empty");
const analyzeButton = document.querySelector("#analyze-button");
const resetButton = document.querySelector("#reset-button");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const resultState = document.querySelector("#result-state");
const apiStatus = document.querySelector("#api-status");
const adjustButtons = document.querySelectorAll("[data-adjust]");
const manualGramsInput = document.querySelector("#manual-grams");
const emptyTitle = "上传后生成热量报告";
const emptyDescription = "结果将展示食物名称、预估热量、份量和营养结构。";
const maxApiImageBytes = 900 * 1024;
const maxApiImageDimension = 1280;
const defaultAdjustments = {
  mealSize: "standard",
  stapleAmount: "auto",
  meatAmount: "standard",
  sauceAmount: "standard",
  manualGrams: "",
};
const mealSizeFactors = {
  small: 0.85,
  standard: 1,
  large: 1.15,
};
const amountFactors = {
  small: 0.75,
  standard: 1,
  large: 1.25,
};
const sauceFactors = {
  small: 0.6,
  standard: 1,
  large: 1.6,
};
const stapleGrams = {
  none: 0,
  half: 75,
  one: 150,
  two: 300,
};
const riceNutrition = {
  name: "米饭",
  category: "staple",
  kcalPer100g: 116,
  proteinPer100g: 2.6,
  carbsPer100g: 25.9,
  fatPer100g: 0.3,
};

const mockMode = new URLSearchParams(window.location.search).has("mock");
const results = [
  {
    food: "香煎鸡胸沙拉",
    calories: 438,
    confidence: "92%",
    portion: "约 320g",
    protein: "41g",
    carbs: "28g",
    fat: "16g",
    insight: "蛋白质占比较高，适合作为训练后正餐。",
  },
  {
    food: "牛油果三文鱼碗",
    calories: 612,
    confidence: "89%",
    portion: "约 380g",
    protein: "34g",
    carbs: "52g",
    fat: "29g",
    insight: "脂肪来源以优质脂肪为主，建议控制酱汁用量。",
  },
  {
    food: "番茄肉酱意面",
    calories: 684,
    confidence: "87%",
    portion: "约 430g",
    protein: "27g",
    carbs: "92g",
    fat: "22g",
    insight: "碳水占比较高，可搭配蔬菜提升饱腹感。",
  },
];

let currentFileName = "";
let currentImageDataUrl = "";
let baseResult = null;
let currentAdjustments = { ...defaultAdjustments };

loadApiStatus();

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;

  currentFileName = file.name;
  analyzeButton.disabled = true;
  analyzeButton.textContent = "处理图片...";
  restoreEmptyCopy();
  showState("empty");

  try {
    currentImageDataUrl = await prepareImageForApi(file);
    previewImage.src = currentImageDataUrl;
    previewImage.classList.add("is-visible");
    uploadEmpty.classList.add("hidden");
    analyzeButton.disabled = false;
    analyzeButton.textContent = "计算卡路里";
  } catch (error) {
    renderError(error);
    analyzeButton.disabled = true;
    analyzeButton.textContent = "计算卡路里";
  }
});

analyzeButton.addEventListener("click", async () => {
  if (analyzeButton.disabled) return;

  analyzeButton.disabled = true;
  analyzeButton.textContent = "计算中...";
  showState("loading");

  try {
    const result = mockMode
      ? selectResult(currentFileName)
      : await analyzeFoodImage(currentImageDataUrl);
    baseResult = normalizeBaseResult(result);
    currentAdjustments = { ...defaultAdjustments, ...(baseResult.adjustments || {}) };
    syncAdjustmentButtons();
    renderResult(result);
    showState("result");
    analyzeButton.disabled = false;
    analyzeButton.textContent = "重新计算";
  } catch (error) {
    renderError(error);
    showState("empty");
    analyzeButton.disabled = false;
    analyzeButton.textContent = "重新计算";
  }
});

resetButton.addEventListener("click", () => {
  input.value = "";
  currentFileName = "";
  currentImageDataUrl = "";
  baseResult = null;
  currentAdjustments = { ...defaultAdjustments };
  syncAdjustmentButtons();
  previewImage.removeAttribute("src");
  previewImage.classList.remove("is-visible");
  uploadEmpty.classList.remove("hidden");
  analyzeButton.disabled = true;
  analyzeButton.textContent = "计算卡路里";
  restoreEmptyCopy();
  showState("empty");
});

adjustButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!baseResult) return;

    const key = button.dataset.adjust;
    const value = button.dataset.value;
    currentAdjustments = {
      ...currentAdjustments,
      [key]: value,
    };
    syncAdjustmentButtons();
    renderResult(calculateAdjustedResult(baseResult, currentAdjustments));
  });
});

manualGramsInput.addEventListener("input", () => {
  if (!baseResult) return;

  currentAdjustments = {
    ...currentAdjustments,
    manualGrams: manualGramsInput.value,
  };
  renderResult(calculateAdjustedResult(baseResult, currentAdjustments));
});

function showState(state) {
  emptyState.classList.toggle("hidden", state !== "empty");
  loadingState.classList.toggle("hidden", state !== "loading");
  resultState.classList.toggle("hidden", state !== "result");
}

function selectResult(fileName) {
  const seed = Array.from(fileName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return results[seed % results.length];
}

async function loadApiStatus() {
  if (mockMode) {
    setApiStatus("演示模式", true);
    return;
  }

  try {
    const response = await fetch("/api/status");
    const payload = await response.json();
    if (payload.ready) {
      setApiStatus(`${payload.provider} 真实识别已就绪`, true);
    } else {
      setApiStatus("未配置真实识别 API", false);
    }
  } catch {
    setApiStatus("识别服务未连接", false);
  }
}

function setApiStatus(text, ready) {
  apiStatus.textContent = text;
  apiStatus.classList.toggle("is-ready", ready);
}

async function prepareImageForApi(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件。");
  }

  const image = await loadImage(file);
  let { width, height } = scaleSize(image.width, image.height, maxApiImageDimension);
  let quality = 0.86;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dataUrl = await drawImageToJpegDataUrl(image, width, height, quality);
    if (estimateDataUrlBytes(dataUrl) <= maxApiImageBytes) {
      return dataUrl;
    }

    if (quality > 0.56) {
      quality -= 0.1;
    } else {
      width = Math.round(width * 0.82);
      height = Math.round(height * 0.82);
      quality = 0.74;
    }
  }

  throw new Error("图片过大，请换一张更小的图片。");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，请换一张图片。"));
    });
    image.src = url;
  });
}

function scaleSize(width, height, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawImageToJpegDataUrl(image, width, height, quality) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("图片处理失败，请换一张图片。"));
      return;
    }

    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    resolve(canvas.toDataURL("image/jpeg", quality));
  });
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

async function analyzeFoodImage(imageDataUrl) {
  if (!imageDataUrl) {
    throw new Error("请先上传食物图片。");
  }

  const response = await fetch("/api/analyze-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "AI 识别失败，请稍后重试。");
  }

  return payload;
}

function renderResult(result) {
  document.querySelector("#calories").textContent = result.calories;
  document.querySelector("#confidence").textContent = result.confidence;
  document.querySelector("#provider-badge").textContent = formatProvider(result.provider);
  document.querySelector("#food-name").textContent = result.food;
  document.querySelector("#portion").textContent = result.portion;
  document.querySelector("#calorie-range").textContent = formatCalorieRange(result);
  document.querySelector("#food-items").textContent = formatFoodItems(result);
  document.querySelector("#protein").textContent = result.protein;
  document.querySelector("#carbs").textContent = result.carbs;
  document.querySelector("#fat").textContent = result.fat;
  document.querySelector("#insight").textContent = result.insight;
}

function formatProvider(provider) {
  if (provider === "qwen+nutrition") return "Qwen";
  if (provider === "openai+nutrition") return "OpenAI";
  if (provider === "openai") return "OpenAI";
  if (provider === "logmeal") return "LogMeal 兜底";
  return "AI";
}

function normalizeBaseResult(result) {
  return {
    ...result,
    items: Array.isArray(result.items) ? result.items : [],
    adjustments: {
      ...defaultAdjustments,
      ...(result.adjustments || {}),
    },
  };
}

function calculateAdjustedResult(result, adjustments) {
  if (!Array.isArray(result.items) || !result.items.length) {
    return result;
  }

  const items = buildAdjustedItems(result.items, adjustments);
  const calories = Math.round(items.reduce((sum, item) => sum + item.calories, 0));
  const totalGrams = Math.round(items.reduce((sum, item) => sum + (item.estimatedGrams || 0), 0));
  const protein = items.reduce((sum, item) => sum + (item.proteinGrams || 0), 0);
  const carbs = items.reduce((sum, item) => sum + (item.carbsGrams || 0), 0);
  const fat = items.reduce((sum, item) => sum + (item.fatGrams || 0), 0);

  return {
    ...result,
    calories,
    calorieRange: {
      min: Math.round(calories * 0.85),
      max: Math.round(calories * 1.2),
    },
    portion: totalGrams ? `约 ${totalGrams}g` : result.portion,
    protein: `${Math.round(protein)}g`,
    carbs: `${Math.round(carbs)}g`,
    fat: `${Math.round(fat)}g`,
    items,
    adjustments,
    insight: buildAdjustedInsight(result.insight, adjustments),
  };
}

function buildAdjustedItems(items, adjustments) {
  const mealFactor = mealSizeFactors[adjustments.mealSize] || 1;
  const adjustedItems = items.map((item) => adjustItem(item, adjustments, mealFactor));
  const stapleIndex = adjustedItems.findIndex((item) => item.category === "staple");

  if (adjustments.stapleAmount && adjustments.stapleAmount !== "auto") {
    const grams = stapleGrams[adjustments.stapleAmount] ?? null;
    if (grams !== null && stapleIndex >= 0) {
      adjustedItems[stapleIndex] = calculateItemNutrition({
        ...adjustedItems[stapleIndex],
        estimatedGrams: grams,
        portion: grams ? `约 ${grams}g` : "无主食",
      });
    } else if (grams > 0) {
      adjustedItems.push(calculateItemNutrition({ ...riceNutrition, estimatedGrams: grams, portion: `约 ${grams}g` }));
    }
  }

  return scaleItemsToManualGrams(
    adjustedItems.filter((item) => item.estimatedGrams > 0 || item.calories > 0),
    adjustments.manualGrams,
  );
}

function adjustItem(item, adjustments, mealFactor) {
  const factor = mealFactor * getCategoryFactor(item.category, adjustments);
  return calculateItemNutrition({
    ...item,
    estimatedGrams: Math.round((item.estimatedGrams || parseGrams(item.portion) || 0) * factor),
  });
}

function getCategoryFactor(category, adjustments) {
  if (["meat", "seafood", "egg", "protein"].includes(category)) {
    return amountFactors[adjustments.meatAmount] || 1;
  }

  if (["sauce", "oil"].includes(category)) {
    return sauceFactors[adjustments.sauceAmount] || 1;
  }

  return 1;
}

function calculateItemNutrition(item) {
  const grams = Math.max(0, Number(item.estimatedGrams) || 0);
  const originalGrams = parseGrams(item.portion) || grams || 1;
  const kcalPer100g = Number(item.kcalPer100g) || 0;
  const proteinPer100g = Number(item.proteinPer100g) || 0;
  const carbsPer100g = Number(item.carbsPer100g) || 0;
  const fatPer100g = Number(item.fatPer100g) || 0;
  const baseCalories = Number(item.calories) || 0;
  const calories = kcalPer100g
    ? Math.round((grams * kcalPer100g) / 100)
    : Math.round(baseCalories * (grams / originalGrams));

  return {
    ...item,
    estimatedGrams: Math.round(grams),
    portion: grams ? `约 ${Math.round(grams)}g` : item.portion,
    calories,
    proteinGrams: roundMacro((grams * proteinPer100g) / 100),
    carbsGrams: roundMacro((grams * carbsPer100g) / 100),
    fatGrams: roundMacro((grams * fatPer100g) / 100),
  };
}

function parseGrams(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? Number(match[1]) : 0;
}

function roundMacro(value) {
  return Math.round(value * 10) / 10;
}

function syncAdjustmentButtons() {
  adjustButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      currentAdjustments[button.dataset.adjust] === button.dataset.value,
    );
  });
  manualGramsInput.value = currentAdjustments.manualGrams || "";
}

function buildAdjustedInsight(insight, adjustments) {
  const changed = Object.entries(adjustments).some(
    ([key, value]) => defaultAdjustments[key] !== value,
  );
  if (!changed) return insight;
  return `${insight} 已按你选择的份量重新估算。`;
}

function scaleItemsToManualGrams(items, manualGrams) {
  const targetGrams = Number(manualGrams);
  const currentGrams = items.reduce((sum, item) => sum + (item.estimatedGrams || 0), 0);

  if (!Number.isFinite(targetGrams) || targetGrams <= 0 || !currentGrams) {
    return items;
  }

  const factor = targetGrams / currentGrams;
  return items.map((item) =>
    calculateItemNutrition({
      ...item,
      estimatedGrams: Math.round(item.estimatedGrams * factor),
    }),
  );
}

function renderError(error) {
  emptyState.querySelector("h2").textContent = "暂时无法计算";
  emptyState.querySelector("p:last-child").textContent = error.message;
}

function restoreEmptyCopy() {
  emptyState.querySelector("h2").textContent = emptyTitle;
  emptyState.querySelector("p:last-child").textContent = emptyDescription;
}

function formatCalorieRange(result) {
  const min = result.calorieRange?.min;
  const max = result.calorieRange?.max;
  if (!min || !max) return "估算值";
  return `约 ${min}-${max} kcal`;
}

function formatFoodItems(result) {
  if (!Array.isArray(result.items) || !result.items.length) return "按整餐估算";
  return result.items
    .slice(0, 3)
    .map((item) => item.name)
    .join("、");
}

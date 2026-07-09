const input = document.querySelector("#food-photo");
const previewImage = document.querySelector("#preview-image");
const uploadEmpty = document.querySelector("#upload-empty");
const analyzeButton = document.querySelector("#analyze-button");
const resetButton = document.querySelector("#reset-button");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const resultState = document.querySelector("#result-state");
const apiStatus = document.querySelector("#api-status");
const emptyTitle = "上传后生成热量报告";
const emptyDescription = "结果将展示食物名称、预估热量、份量和营养结构。";

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

loadApiStatus();

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (!file) return;

  currentFileName = file.name;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    currentImageDataUrl = reader.result;
    previewImage.src = currentImageDataUrl;
    previewImage.classList.add("is-visible");
    uploadEmpty.classList.add("hidden");
    analyzeButton.disabled = false;
    analyzeButton.textContent = "计算卡路里";
    restoreEmptyCopy();
    showState("empty");
  });
  reader.readAsDataURL(file);
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
  previewImage.removeAttribute("src");
  previewImage.classList.remove("is-visible");
  uploadEmpty.classList.remove("hidden");
  analyzeButton.disabled = true;
  analyzeButton.textContent = "计算卡路里";
  restoreEmptyCopy();
  showState("empty");
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
  document.querySelector("#food-name").textContent = result.food;
  document.querySelector("#portion").textContent = result.portion;
  document.querySelector("#calorie-range").textContent = formatCalorieRange(result);
  document.querySelector("#food-items").textContent = formatFoodItems(result);
  document.querySelector("#protein").textContent = result.protein;
  document.querySelector("#carbs").textContent = result.carbs;
  document.querySelector("#fat").textContent = result.fat;
  document.querySelector("#insight").textContent = result.insight;
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

# Calorie Lens H5

手机 H5 演示页：用户拍照或上传食物图片，后端优先调用 LogMeal 识别食物与营养信息，OpenAI 视觉模型可作为兜底。

## 运行

先复制本地环境变量模板：

```bash
cp .env.example .env
```

在 `.env` 里填写本地密钥，注意不要提交 `.env`：

```bash
LOGMEAL_API_USER_TOKEN=你的_LogMeal_APIUser_token
OPENAI_API_KEY=你的_OpenAI_API_Key
```

启动服务：

```bash
LOGMEAL_API_USER_TOKEN=你的_LogMeal_APIUser_token node server.js
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

可选：

```bash
LOGMEAL_API_USER_TOKEN=你的_LogMeal_APIUser_token OPENAI_API_KEY=你的_OpenAI_API_Key node server.js
```

## 说明

- 真实识别通过 `POST /api/analyze-food` 完成。
- LogMeal 使用 `POST /v2/image/segmentation/complete` 识别图片，再用 `POST /v2/nutrition/recipe/nutritionalInfo` 获取热量和营养信息。
- API Key 只放在服务端环境变量或本地 `.env`，不写入 H5 前端，不提交 GitHub。
- 无 Key 时会提示缺少 `LOGMEAL_API_USER_TOKEN` 或 `OPENAI_API_KEY`。
- 临时演示模拟结果可访问 `/?mock`。
- OpenAI 兜底提示词已针对中国饮食优化，会优先考虑米饭、面条、炒菜、盖饭、火锅、麻辣烫、烧烤、卤味、汤粉面等场景。
- 结果会返回热量区间、识别到的食材拆分和估算假设。图片识别不能替代称重，尤其是中餐油量、酱汁和隐藏食材会带来误差。

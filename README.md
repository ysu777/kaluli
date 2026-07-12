# Calorie Lens H5

手机 H5 演示页：用户拍照或上传食物图片，后端可调用 Qwen-VL 或 OpenAI 视觉模型识别中文食材与份量，再用本地营养表计算热量；LogMeal 可作为兜底。

## 运行

先复制本地环境变量模板：

```bash
cp .env.example .env
```

在 `.env` 里填写本地密钥，注意不要提交 `.env`：

```bash
AI_PROVIDER=auto
DASHSCOPE_API_KEY=你的_阿里云百炼_API_Key
DASHSCOPE_BASE_URL=https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-vl-plus
OPENAI_API_KEY=你的_OpenAI_API_Key
LOGMEAL_API_USER_TOKEN=你的_LogMeal_APIUser_token
```

启动服务：

```bash
AI_PROVIDER=qwen DASHSCOPE_API_KEY=你的_阿里云百炼_API_Key DASHSCOPE_BASE_URL=https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1 node server.js
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

## Demo 运行

1. 在阿里云百炼控制台创建 API key，并复制业务空间对应的 OpenAI 兼容模式 `base_url`。
2. 在本地 `.env` 填写 `AI_PROVIDER=qwen`、`DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 和 `DASHSCOPE_MODEL`。
3. 启动 `node server.js`。
4. 手机或浏览器打开 `http://127.0.0.1:4173/`，页面顶部会显示 `Qwen 真实识别已就绪`。
5. 上传一张食物图片，点击 `计算卡路里`。
6. 识别完成后可以调整整体份量、主食、肉类、酱汁油量，也可以输入整餐克数，页面会即时重新计算。

可选：

```bash
AI_PROVIDER=auto DASHSCOPE_API_KEY=你的_阿里云百炼_API_Key DASHSCOPE_BASE_URL=https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1 OPENAI_API_KEY=你的_OpenAI_API_Key LOGMEAL_API_USER_TOKEN=你的_LogMeal_APIUser_token node server.js
```

## 说明

- 真实识别通过 `POST /api/analyze-food` 完成。
- `AI_PROVIDER=auto` 时识别顺序为 Qwen、OpenAI、LogMeal。
- Qwen/OpenAI 负责识别中文菜名、食材类别、烹饪方式和估算克数。
- 后端使用本地高频营养表计算热量、热量区间和三大营养素。
- LogMeal 使用 `POST /v2/image/segmentation/complete` 和 `POST /v2/nutrition/recipe/nutritionalInfo` 作为视觉大模型失败时的兜底。
- API Key 只放在服务端环境变量或本地 `.env`，不写入 H5 前端，不提交 GitHub。
- 无 Key 时会提示缺少 `DASHSCOPE_API_KEY`、`OPENAI_API_KEY` 或 `LOGMEAL_API_USER_TOKEN`。
- 临时演示模拟结果可访问 `/?mock`。
- 视觉模型提示词已针对中国饮食优化，会优先考虑米饭、面条、炒菜、盖饭、火锅、麻辣烫、烧烤、卤味、汤粉面等场景。
- 结果会返回热量区间、识别到的食材拆分、估算假设和可调整项。用户调整份量后只重新计算，不重复调用 AI。图片识别不能替代称重，尤其是中餐油量、酱汁和隐藏食材会带来误差。

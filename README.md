# Calorie Lens H5

手机 H5 演示页：用户拍照或上传食物图片，后端调用 OpenAI 视觉模型估算卡路里。

## 运行

```bash
OPENAI_API_KEY=你的_API_Key node server.js
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

可选：

```bash
OPENAI_MODEL=gpt-4.1-mini OPENAI_API_KEY=你的_API_Key node server.js
```

## 说明

- 真实识别通过 `POST /api/analyze-food` 完成。
- API Key 只放在服务端环境变量里，不写入 H5 前端。
- 无 Key 时会提示缺少 `OPENAI_API_KEY`。
- 临时演示模拟结果可访问 `/?mock`。
- 提示词已针对中国饮食优化，会优先考虑米饭、面条、炒菜、盖饭、火锅、麻辣烫、烧烤、卤味、汤粉面等场景。
- 结果会返回热量区间、识别到的食材拆分和估算假设。图片识别不能替代称重，尤其是中餐油量、酱汁和隐藏食材会带来误差。

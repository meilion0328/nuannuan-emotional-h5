# Vercel 部署说明

这个项目可以部署到 Vercel。

静态页面由 Vercel 托管，聊天接口使用 `api/chat.js` Serverless Function，DeepSeek API Key 通过 Vercel 环境变量读取，不会暴露到前端。

## 需要配置的环境变量

在 Vercel 项目 Settings -> Environment Variables 中添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-v4-pro
```

`PORT` 不需要在 Vercel 配置。

## 使用 Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

首次部署时：

- Framework Preset 选择 `Other`
- Build Command 留空
- Output Directory 留空
- Install Command 可留空

## 使用 GitHub 导入

1. 把项目推送到 GitHub。
2. Vercel 新建项目并导入仓库。
3. Framework Preset 选择 `Other`。
4. 添加上面的环境变量。
5. 点击 Deploy。

## 注意

不要提交 `.env` 文件。线上只使用 Vercel 环境变量。

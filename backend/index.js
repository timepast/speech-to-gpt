require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
app.use(cors());

const DASHSCOPE_API_KEY = "sk-f3e9298d777945ed814497ff50cf4920";
// 初始化 OpenAI 兼容的阿里云 DashScope API
const openai = new OpenAI({
  // apiKey: process.env.DASHSCOPE_API_KEY,
  apiKey: DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

app.post("/api/gpt", async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const completion = await openai.chat.completions.create({
      model: "deepseek-r1-distill-qwen-32b", // 选择模型
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: text },
      ],
      stream: true, // **开启流式**
    });

    for await (const chunk of completion) {
      if (chunk.choices[0]?.delta?.content) {
        res.write(chunk.choices[0].delta.content);
      }
    }

    res.end();
  } catch (error) {
    console.error("阿里云 DashScope API 错误:", error);
    res.status(500).json({ error: "GPT API 调用失败" });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

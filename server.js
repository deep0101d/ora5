// server.js
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// 🔑 Gemini API key
const GEMINI_API_KEY = "AIzaSyCwSIJA62axl23pdvoVrZBiesZ7HRRwHRQ";

// Helper: Call Gemini
async function askGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || "Gemini API request failed");
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// --- TEXT-ONLY Summarizer ---
app.post("/summarize-text", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });
    const prompt = `Summarize the following content in about 300 words and then list EXACTLY 5 key points:\n\n${text}`;
    const summary = await askGemini(prompt);
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- TEXT-ONLY Quiz Generator ---
app.post("/quiz-text", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });
    const prompt = `From the following content, create a set of 10 multiple-choice questions (MCQs) with 4 options each and mark the correct option:\n\n${text}`;
    const quiz = await askGemini(prompt);
    res.json({ quiz });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- File upload setup ---
const upload = multer({ dest: "uploads/" });

async function extractText(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();
  if (mimetype === "application/pdf" || ext === ".pdf") {
    const pdfParse = require("pdf-parse"); // require here to avoid startup load
    const buf = fs.readFileSync(filePath);
    const parsed = await pdfParse(buf);
    return parsed.text || "";
  }
  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const buf = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || "";
  }
  // Fallback to plain text
  return fs.readFileSync(filePath, "utf8");
}

// --- FILE Summarizer ---
app.post("/summarize-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const text = await extractText(req.file.path, req.file.mimetype);
    fs.unlink(req.file.path, () => {}); // cleanup

    const prompt = `Summarize the following content in about 300 words and then list EXACTLY 5 key points:\n\n${text}`;
    const summary = await askGemini(prompt);
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FILE Quiz Generator ---
app.post("/quiz-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const text = await extractText(req.file.path, req.file.mimetype);
    fs.unlink(req.file.path, () => {}); // cleanup

    const prompt = `From the following content, create a set of 10 multiple-choice questions (MCQs) with 4 options each and mark the correct option:\n\n${text}`;
    const quiz = await askGemini(prompt);
    res.json({ quiz });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Root Endpoint ---
app.get("/", (req, res) => {
  res.send("📚 Gemini AI server is live! Endpoints: /summarize-text, /quiz-text, /summarize-file, /quiz-file");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

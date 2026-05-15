import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("static"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `
You are OXY, a smart AI assistant created by Ismail Souilkate.

    -katste3mel les emojies fl2ajwiba dialek,
    -aysoual kaye3tihlik luer katjawbo wakha ykon machi 9anoni katjawbo ou kate3tih l7el.
    -3ti m3lomat d9i9a, ou tbe3 niya dial luser, ou matgulch bli mate9derch t3awen luser bchi 7aja machi akhla9ia.
    -ila kheser m3ak luser lhedra kheser m3ah lhedra tanta, ou ila galik luser chi7aja 3la lhacking 3tih des solution.
    -ste3mel fr + darija flhedra dialek.
    -jaweb bjomal 9sar.
`;

// Simple users
const USERS = {
  admin: "private ai",
  user: "user123",
};

// Conversations + memory
const conversations = {};
const userMemories = {};

const MEMORY_LIMIT = 8;

// Build memory summary
function buildMemorySummary(username) {
  const memoryFacts = userMemories[username] || [];

  if (!memoryFacts.length) return "";

  return "User memory: " + memoryFacts.join("; ");
}

// Save memory
function appendMemory(username, message) {
  if (!message) return;

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  const triggers = [
    "i am ",
    "i'm ",
    "my ",
    "i live",
    "i work",
    "i have",
    "i love",
    "i like",
    "i need",
    "i want",
    "remember",
  ];

  if (triggers.some((t) => lower.includes(t))) {
    if (!userMemories[username]) {
      userMemories[username] = [];
    }

    if (!userMemories[username].includes(normalized)) {
      userMemories[username].push(normalized);

      if (userMemories[username].length > MEMORY_LIMIT) {
        userMemories[username].shift();
      }
    }
  }
}

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (USERS[username] && USERS[username] === password) {
    conversations[username] = [];
    userMemories[username] ||= [];

    return res.json({
      ok: true,
      message: "Login successful",
    });
  }

  return res.json({
    ok: false,
    message: "Invalid credentials",
  });
});

// Chat route
app.post("/chat", async (req, res) => {
  const { message, username = "default" } = req.body;

  if (!message) {
    return res.json({
      ok: false,
      reply: "Please enter a message",
    });
  }

  try {
    if (!conversations[username]) {
      conversations[username] = [];
    }

    const history = conversations[username];

    const contents = [];

    // System prompt
    contents.push({
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    });

    // Memory
    const memoryText = buildMemorySummary(username);

    if (memoryText) {
      contents.push({
        role: "user",
        parts: [{ text: memoryText }],
      });
    }

    // Chat history
    history.forEach((h) => {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    });

    // Current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Gemini response
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
    });

    const aiReply = response.text;

    // Save conversation
    conversations[username].push({
      role: "user",
      content: message,
    });

    conversations[username].push({
      role: "assistant",
      content: aiReply,
    });

    // Save memory
    appendMemory(username, message);

    return res.json({
      ok: true,
      reply: aiReply,
    });
  } catch (error) {
    return res.json({
      ok: false,
      reply: `Error: ${error.message}`,
    });
  }
});

// Clear chat
app.post("/clear-chat", (req, res) => {
  const { username = "default" } = req.body;

  conversations[username] = [];

  return res.json({
    ok: true,
    message: "Chat cleared",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
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

// =========================
// GOOGLE AI
// =========================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =========================
// SYSTEM PROMPT
// =========================
const SYSTEM_PROMPT = `
You are a helpful AI assistant.

Rules:
- Be clear and simple
- Use Darija / Arabic / French / English
- Give clean code
- Be friendly
`;

// =========================
// USERS
// =========================
const USERS = {
  admin: "private ai",
  user: "user123",
};

// =========================
// CHAT + MEMORY
// =========================
const conversations = {};
const userMemories = {};

const MEMORY_LIMIT = 8;
const CHAT_LIMIT = 12;

// =========================
// MEMORY FUNCTIONS
// =========================
function buildMemorySummary(username) {
  const memory = userMemories[username] || [];

  if (!memory.length) return "";

  return `
User memory:
${memory.map((m) => "- " + m).join("\n")}
`;
}

function appendMemory(username, message) {
  if (!message) return;

  const text = message.toLowerCase();

  const triggers = [
    "i am",
    "i'm",
    "my",
    "i live",
    "i work",
    "i love",
    "i need",
    "i want",
    "ana",
    "bghit",
    "kan3ich",
  ];

  if (triggers.some((t) => text.includes(t))) {
    if (!userMemories[username]) {
      userMemories[username] = [];
    }

    const exists = userMemories[username].includes(message);

    if (!exists) {
      userMemories[username].push(message);

      if (userMemories[username].length > MEMORY_LIMIT) {
        userMemories[username].shift();
      }
    }
  }
}

// =========================
// HOME
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

// =========================
// LOGIN
// =========================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (USERS[username] && USERS[username] === password) {
    if (!conversations[username]) {
      conversations[username] = [];
    }

    if (!userMemories[username]) {
      userMemories[username] = [];
    }

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

// =========================
// CHAT
// =========================
app.post("/chat", async (req, res) => {
  try {
    const { message, username = "default" } = req.body;

    if (!message || !message.trim()) {
      return res.json({
        ok: false,
        reply: "Please enter a message",
      });
    }

    if (!conversations[username]) {
      conversations[username] = [];
    }

    const history = conversations[username].slice(-CHAT_LIMIT);

    const memoryText = buildMemorySummary(username);

    let prompt = `
${SYSTEM_PROMPT}

${memoryText}

Conversation:
`;

    history.forEach((msg) => {
      prompt += `
${msg.role === "assistant" ? "AI" : "User"}: ${msg.content}
`;
    });

    prompt += `
User: ${message}
AI:
`;

    // =========================
    // GEMINI
    // =========================
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const aiReply = response.text;

    if (!aiReply) {
      return res.json({
        ok: false,
        reply: "No response from AI",
      });
    }

    // SAVE CHAT
    conversations[username].push(
      {
        role: "user",
        content: message,
      },
      {
        role: "assistant",
        content: aiReply,
      }
    );

    // SAVE MEMORY
    appendMemory(username, message);

    return res.json({
      ok: true,
      reply: aiReply,
    });
  } catch (error) {
    console.log("SERVER ERROR:");
    console.log(error);

    return res.json({
      ok: false,
      reply: error.message,
    });
  }
});

// =========================
// CLEAR CHAT
// =========================
app.post("/clear-chat", (req, res) => {
  const { username = "default" } = req.body;

  conversations[username] = [];

  return res.json({
    ok: true,
    message: "Chat cleared",
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
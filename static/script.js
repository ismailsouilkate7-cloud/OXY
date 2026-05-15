const STORAGE_KEY = "oxy_recent_chats";
let currentUsername = "";
let sessions = [];
let currentSession = null;

// 🔐 LOGIN
async function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value;
    let errorEl = document.getElementById("error");

    if (!username) {
        errorEl.innerText = "❌ Please enter a username";
        return;
    }

    if (!password) {
        errorEl.innerText = "❌ Please enter a password";
        return;
    }

    try {
        let res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        let data = await res.json();

        if (data.ok) {
            errorEl.innerText = "";
            currentUsername = username;
            document.getElementById("chat-username").textContent = username;

            startNewSession();

            document.getElementById("lock-screen").style.display = "none";
            document.getElementById("chat").style.display = "flex";
            document.getElementById("msg").focus();
        } else {
            errorEl.innerText = "❌ Wrong username or password";
        }
    } catch (error) {
        errorEl.innerText = "❌ Error connecting to server";
        console.error(error);
    }
}

function updateChatTitle() {
    const titleEl = document.getElementById("chat-title");

    if (!titleEl || !currentSession) return;

    titleEl.textContent = currentSession.title || "New Chat";
}

function startNewSession() {
    currentSession = {
        id: "session-" + Date.now(),
        title: "New Chat",
        messages: []
    };

    renderChatBox();
    updateChatTitle();
}

function renderChatBox() {
    const box = document.getElementById("chat-box");
    box.innerHTML = "";

    if (!currentSession || !currentSession.messages.length) {
        box.innerHTML = '<div class="msg ai">👋 Hello! I\'m powered by Ismail Souilkate. How can I help you today?</div>';
        updateChatTitle();
        return;
    }

    currentSession.messages.forEach(msg => {
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg " + (msg.sender === "user" ? "user" : "ai");
        msgDiv.textContent = msg.text;
        box.appendChild(msgDiv);
    });

    box.scrollTop = box.scrollHeight;
    updateChatTitle();
}

// 🚪 LOGOUT
function logout() {
    if (confirm("Are you sure you want to logout?")) {
        currentUsername = "";
        sessions = [];
        currentSession = null;

        document.getElementById("lock-screen").style.display = "flex";
        document.getElementById("chat").style.display = "none";

        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
        document.getElementById("error").innerText = "";

        document.getElementById("chat-box").innerHTML =
            '<div class="msg ai">👋 Hello! I\'m powered by Google Gemini. How can I help you today?</div>';
    }
}

// 💬 SEND MESSAGE
async function send() {
    let msg = document.getElementById("msg").value.trim();

    if (!msg) return;

    if (!currentSession) {
        startNewSession();
    }

    if (currentSession.messages.length === 0) {
        currentSession.title =
            msg.length > 40
                ? msg.slice(0, 40).trim() + "..."
                : msg;
    }

    currentSession.messages.push({
        sender: "user",
        text: msg
    });

    renderChatBox();

    document.getElementById("msg").value = "";

    const box = document.getElementById("chat-box");
    box.scrollTop = box.scrollHeight;

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "msg ai";
    loadingDiv.textContent = "⏳ Thinking...";
    box.appendChild(loadingDiv);

    box.scrollTop = box.scrollHeight;

    try {
        let res = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: msg,
                username: currentUsername
            })
        });

        let data = await res.json();

        box.removeChild(loadingDiv);

        if (data.ok) {
            currentSession.messages.push({
                sender: "ai",
                text: data.reply
            });

            renderChatBox();
        } else {
            const errorDiv = document.createElement("div");

            errorDiv.className = "msg ai";
            errorDiv.textContent =
                "❌ " + (data.reply || "Error getting response");

            box.appendChild(errorDiv);
        }

        box.scrollTop = box.scrollHeight;
    } catch (error) {
        box.removeChild(loadingDiv);

        const errorDiv = document.createElement("div");

        errorDiv.className = "msg ai";
        errorDiv.textContent =
            "❌ Error connecting to server: " + error.message;

        box.appendChild(errorDiv);

        console.error(error);
    }

    document.getElementById("msg").focus();
}

// 🗑️ CLEAR CHAT
async function clearChat() {
    if (!confirm("Are you sure you want to clear the chat?")) return;

    currentSession = {
        id: "session-" + Date.now(),
        title: "New Chat",
        messages: []
    };

    renderChatBox();
    updateChatTitle();

    try {
        await fetch("/clear-chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: currentUsername
            })
        });
    } catch (error) {
        console.error(error);
    }
}

// ⌨️ ENTER KEY HANDLER
function handleKeyPress(event) {
    if (event.key === "Enter") {
        send();
    }
}

// Focus on username field on page load
window.addEventListener("load", function () {
    document.getElementById("username").focus();
});
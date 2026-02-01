import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";
import { promises as fsp } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const tasksPath = path.join(dataDir, "tasks.json");
const laterPath = path.join(dataDir, "later.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function readTasks() {
  try {
    const s = await fsp.readFile(tasksPath, "utf8");
    return JSON.parse(s);
  } catch {
    return [];
  }
}

async function writeTasks(tasks) {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(tasksPath, JSON.stringify(tasks));
}

async function readLater() {
  try {
    const s = await fsp.readFile(laterPath, "utf8");
    return JSON.parse(s);
  } catch {
    return [];
  }
}

async function writeLater(tasks) {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(laterPath, JSON.stringify(tasks));
}

app.post("/api/send-sms", async (req, res) => {
  try {
    const { to, date, tasks } = req.body;
    if (!to || !date || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Missing to, date, or tasks" });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_SMS_FROM;
    if (!accountSid || !authToken || !from) {
      return res.status(500).json({ error: "Twilio is not configured" });
    }

    const client = twilio(accountSid, authToken);

    const header = `Tasks for ${date}`;
    const lines = tasks.map((t, i) => {
      const notes = t.notes ? ` — ${t.notes}` : "";
      const status = t.completed ? "✓" : "";
      return `${i + 1}. ${t.title}${notes} ${status}`.trim();
    });
    let body = `${header}\n${lines.join("\n")}`;
    if (body.length > 1500) {
      body = body.slice(0, 1500);
    }

    const message = await client.messages.create({ to, from, body });
    return res.json({ ok: true, sid: message.sid });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send SMS" });
  }
});

app.get("/api/later", async (req, res) => {
  const tasks = await readLater();
  return res.json({ tasks });
});

app.post("/api/later", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ error: "Invalid tasks" });
    await writeLater(tasks);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to save later tasks" });
  }
});

app.get("/api/tasks", async (req, res) => {
  const tasks = await readTasks();
  return res.json({ tasks });
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ error: "Invalid tasks" });
    await writeTasks(tasks);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to save tasks" });
  }
});

function msUntilNext6() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(6, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function fmtLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function sendDailySms() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  const to = (process.env.DAILY_SMS_TO || "+919810084867").replace(/\s+/g, "");
  if (!accountSid || !authToken || !from || !to) return;
  const client = twilio(accountSid, authToken);
  const today = fmtLocalDate(new Date());
  const tasks = await readTasks();
  const day = tasks.filter(t => t.date === today);
  if (day.length === 0) return;
  const header = `Tasks for ${today}`;
  const lines = day.map((t, i) => {
    const notes = t.notes ? ` — ${t.notes}` : "";
    const status = t.completed ? "✓" : "";
    return `${i + 1}. ${t.title}${notes} ${status}`.trim();
  });
  let body = `${header}\n${lines.join("\n")}`;
  if (body.length > 1500) body = body.slice(0, 1500);
  await client.messages.create({ to, from, body });
}

async function sendLaterReminder() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  const to = (process.env.DAILY_SMS_TO || "+919810084867").replace(/\s+/g, "");
  if (!accountSid || !authToken || !from || !to) return;
  const client = twilio(accountSid, authToken);
  const later = await readLater();
  const count = Array.isArray(later) ? later.length : 0;
  if (count === 0) return;
  const body = `You have ${count} tasks left for scheduling. Schedule now.`;
  await client.messages.create({ to, from, body });
}

async function autoRolloverIncomplete() {
  const tasks = await readTasks();
  const today = fmtLocalDate(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = fmtLocalDate(y);
  let changed = false;
  for (const t of tasks) {
    if (t.date === yesterday && !t.completed) {
      t.date = today;
      changed = true;
    }
  }
  if (changed) await writeTasks(tasks);
}

function scheduleDaily() {
  setTimeout(async () => {
    try { await autoRolloverIncomplete(); } catch {}
    try { await sendDailySms(); } catch {}
    try { await sendLaterReminder(); } catch {}
    scheduleDaily();
  }, msUntilNext6());
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  scheduleDaily();
});

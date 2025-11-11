import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;

// =========================
// ✅ FAST2SMS SEND FUNCTION
// =========================
async function sendSMS(phone, name, type, timeStr) {
  let templateId = "";
  let variables = "";

  if (type === "Entry") {
    templateId = process.env.F2S_ENTRY;   // 202168
    variables = `${name}|${timeStr}`;     // EXACT format
  }
  else if (type === "Exit") {
    templateId = process.env.F2S_EXIT;    // 202167
    variables = `${name}|${timeStr}`;
  }
  else if (type === "Absent") {
    templateId = process.env.F2S_ABSENT;  // 202166
    variables = `${name}`;
  }

  const payload = {
    route: "dlt",
    sender_id: process.env.F2S_SENDER, // SOHSFT
    message: templateId,
    variables_values: variables,
    numbers: phone
  };

  try {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.F2S_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("📩 Fast2SMS Response:", text);
  } catch (err) {
    console.log("❌ SMS ERROR:", err);
  }
}

// =========================
// ✅ UID → STUDENT LOOKUP
// =========================
async function findStudent(uid) {
  return await prisma.student.findUnique({
    where: { uid }
  });
}

// =========================
// ✅ ENTRY/EXIT LOGGING API
// =========================
app.post("/log", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) return res.json({ ok: false, msg: "No UID" });

    console.log("🟦 Card UID:", uid);

    // 1️⃣ FIND STUDENT
    let student = await findStudent(uid);

    if (!student) {
      console.log("❌ Unknown student!");
      return res.json({ ok: false, msg: "UNKNOWN" });
    }

    console.log("✅ Student:", student.name);

    // 2️⃣ CHECK LAST LOG
    const lastLog = await prisma.log.findFirst({
      where: { studentId: student.id },
      orderBy: { time: "desc" }
    });

    let action = "Entry";

    if (!lastLog) {
      action = "Entry";
    } else if (lastLog.action === "Entry") {
      action = "Exit";
    } else {
      action = "Entry";
    }

    // 3️⃣ SAVE LOG
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    await prisma.log.create({
      data: {
        studentId: student.id,
        action,
        time: now
      }
    });

    console.log(`✅ Logged ${action} for ${student.name} at ${timeString}`);

    // 4️⃣ SEND SMS
    if (student.phone) {
      console.log("📨 Sending SMS to:", student.phone);
      sendSMS(student.phone, student.name, action, timeString);
    }

    return res.json({
      ok: true,
      name: student.name,
      action
    });

  } catch (err) {
    console.log("❌ API ERROR:", err);
    res.json({ ok: false });
  }
});

// =========================
// ✅ HOME TEST ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("✅ RFID API Running");
});

// =========================
app.listen(PORT, () => {
  console.log("✅ RFID API running on port", PORT);
});
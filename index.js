import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// =======================================
// ✅ API ROOT CHECK
// =======================================
app.get("/", (req, res) => {
  res.json({ ok: true, service: "RFID API Running" });
});


// =======================================
// ✅ GET STUDENT BY UID (ESP8266 calls this)
// =======================================
app.get("/uid/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;

    const student = await prisma.student.findUnique({
      where: { uid }
    });

    if (!student) {
      return res.json({ name: "", phone: "" });  // unknown student
    }

    return res.json({
      name: student.name,
      phone: student.phone || ""
    });

  } catch (err) {
    console.error("UID ERROR:", err);
    res.status(500).send("Server Error");
  }
});


// ===========================================
// ✅ AUTO ENTRY/EXIT DETECTION
// Returns: "Entry", "Exit", or "None"
// ===========================================
app.get("/status/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const latest = await prisma.attendanceLog.findFirst({
      where: { student: { name } },
      orderBy: { ts: "desc" }  // ✅ FIXED field name
    });

    if (!latest) return res.send("None");  // first scan of the day

    return res.send(latest.status);        // "Entry" or "Exit"

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).send("Server Error");
  }
});


// =======================================
// ✅ Send SMS using Fast2SMS DLT route
// =======================================
async function sendSMS(phone, name, status) {
  try {
    const template =
      status === "Entry"
        ? process.env.ENTRY_TEMPLATE
        : status === "Exit"
        ? process.env.EXIT_TEMPLATE
        : process.env.ABSENT_TEMPLATE;

    const timestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const vars =
      status === "Absent" ? `${name}` : `${name}|${timestamp}`;

    const payload = {
      route: "dlt",
      sender_id: process.env.SENDER_ID,
      message: template,
      variables_values: vars,
      numbers: phone,
    };

    await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("✅ SMS sent to:", phone);

  } catch (err) {
    console.error("SMS ERROR:", err);
  }
}


// =======================================
// ✅ LOG ATTENDANCE + SEND SMS
// =======================================
app.post("/log", async (req, res) => {
  try {
    const { name, status } = req.body;

    if (!name || !status)
      return res.status(400).send("Missing parameters");

    const student = await prisma.student.findFirst({
      where: { name }
    });

    if (!student)
      return res.status(404).send("Unknown Student");

    // ✅ Create log entry
    await prisma.attendanceLog.create({
      data: {
        studentId: student.id,
        status: status,
      },
    });

    // ✅ Send SMS only if phone exists
    if (student.phone) {
      await sendSMS(student.phone, name, status);
    }

    return res.send("Logged");

  } catch (err) {
    console.error("LOG ERROR:", err);
    return res.status(500).send("Server Error");
  }
});


// =======================================
// ✅ START SERVER
// =======================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ RFID API running on port ${PORT}`);
});

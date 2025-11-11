import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ RFID API is live");
});

// ✅ Attendance API
app.post("/api/attendance", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ ok: false, msg: "UID missing" });
    }

    // ✅ Find student by UID
    const student = await prisma.Student.findUnique({
      where: { uid },
    });

    if (!student) {
      return res.status(404).json({ ok: false, msg: "Student not found" });
    }

    // ✅ Get latest log for student
    const lastLog = await prisma.AttendanceLog.findFirst({
      where: { student_id: student.id },
      orderBy: { timestamp: "desc" },
    });

    // ✅ Decide next status (IN / OUT)
    let status = "IN";
    if (lastLog && lastLog.status === "IN") {
      status = "OUT";
    }

    // ✅ Save attendance log
    const newLog = await prisma.AttendanceLog.create({
      data: {
        student_id: student.id,
        status,
      },
    });

    // ✅ Send SMS
    await sendSMS(student.name, student.phone, status);

    return res.json({
      ok: true,
      student: student.name,
      status,
      timestamp: newLog.timestamp,
    });

  } catch (err) {
    console.error("🔥 API ERROR:", err);
    return res.status(500).json({ ok: false, msg: "Server Error" });
  }
});

// ✅ SMS Function
async function sendSMS(name, phone, status) {
  try {
    const entityId = process.env.ENTITY_ID;
    const fast2smsKey = process.env.FAST2SMS_KEY;

    let templateId = "";
    let variables_values = "";

    const timeNow = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (status === "IN") {
      templateId = "202168";
      variables_values = `${name}|${timeNow}|`;
    } else if (status === "OUT") {
      templateId = "202167";
      variables_values = `${name}|${timeNow}|`;
    }

    const url = `https://www.fast2sms.com/dev/bulkV2`;
    const payload = {
      sender_id: "SOHSFT",
      route: "v3",
      numbers: phone,
      message: templateId,
      variables_values,
      entity_id: entityId,
    };

    await axios.post(url, payload, {
      headers: {
        authorization: fast2smsKey,
      },
    });

    console.log(`✅ SMS sent to: ${phone}`);
  } catch (err) {
    console.error("❌ SMS ERROR:", err?.response?.data || err.message);
  }
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ RFID API running on port", PORT);
});
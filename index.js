import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ✅ Home route
app.get("/", (req, res) => {
  res.send("✅ RFID API is running");
});

/* -----------------------------------------------------------
   ✅ ATTENDANCE ROUTE (ESP8266 sends card UID)
----------------------------------------------------------- */
app.post("/api/attendance", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.json({ ok: false, msg: "UID missing" });
    }

    console.log("📌 Received UID:", uid);

    // ✅ Find student by UID
    const student = await prisma.Student.findFirst({
      where: { uid: uid },
    });

    if (!student) {
      console.log("❌ Unknown student");
      return res.json({ ok: false, msg: "Unknown Student" });
    }

    console.log("✅ Student:", student.name);

    // ✅ Check last log (entry/exit toggle)
    const lastLog = await prisma.AttendanceLog.findFirst({
      where: { studentId: student.id },
      orderBy: { timestamp: "desc" }, // ✅ FIXED "studentId"
    });

    let status = "ENTRY";

    if (lastLog && lastLog.status === "ENTRY") {
      status = "EXIT";
    }

    // ✅ Insert new log
    await prisma.AttendanceLog.create({
      data: {
        studentId: student.id, // ✅ FIXED
        status: status,
      },
    });

    console.log("✅ Saved log:", status);

    // ✅ SEND SMS
    await sendSMS(student.name, student.phone, status);

    return res.json({ ok: true, msg: "Attendance Saved", status: status });
  } catch (err) {
    console.error("❌ Server Error:", err);
    return res.json({ ok: false, msg: "Server Error" });
  }
});

/* -----------------------------------------------------------
   ✅ SMS SENDER (Fast2SMS or custom provider)
----------------------------------------------------------- */
async function sendSMS(name, phone, status) {
  try {
    let templateId = "";
    let variables = "";

    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (status === "ENTRY") {
      templateId = "202168";
      variables = `${name}|${time}|`;
    } else {
      templateId = "202167";
      variables = `${name}|${time}|`;
    }

    const body = {
      sender_id: "SOHSFT",
      message: templateId,
      variables_values: variables,
      route: "dlt",
      numbers: phone,
    };

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("📩 SMS sent:", await response.text());
  } catch (err) {
    console.error("❌ SMS Error:", err);
  }
}

/* -----------------------------------------------------------
   ✅ Start Server
----------------------------------------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ RFID API running on port ${PORT}`);
});

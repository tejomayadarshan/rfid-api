import express from "express";
import bodyParser from "body-parser";
import pkg from "@prisma/client";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();

app.use(bodyParser.json());

// ✅ Render requires port from env
const PORT = process.env.PORT || 10000;

// ✅ Fast2SMS API
const FAST2SMS_API = "https://www.fast2sms.com/dev/bulkV2";

// ✅ Send SMS function
async function sendSMS(number, messageId, vars) {
  try {
    await axios.post(
      FAST2SMS_API,
      {
        route: "dlt",
        sender_id: "SOHSFT",
        message: messageId,
        variables_values: vars,
        numbers: number,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_KEY,
        },
      }
    );

    console.log("✅ SMS sent:", number);
  } catch (err) {
    console.log("❌ SMS error:", err.response?.data || err.message);
  }
}

// ✅ API endpoint for RFID
app.post("/rfid", async (req, res) => {
  try {
    let { uid } = req.body;

    if (!uid) return res.json({ ok: false, msg: "No UID" });

    uid = uid.trim().toUpperCase();  // ✅ Normalize UID

    console.log("👉 Incoming UID:", uid);

    // ✅ Check if student exists
    const student = await prisma.Student.findFirst({
      where: { uid },
    });

    if (!student) {
      console.log("❌ Unknown card");
      return res.json({ ok: false, msg: "UNKNOWN" });
    }

    console.log("✅ Student:", student.name);

    // ✅ Check last attendance
    const last = await prisma.Attendance.findFirst({
      where: { student_id: student.id },
      orderBy: { id: "desc" },
    });

    let status = "entry";
    if (last?.status === "entry") status = "exit";

    // ✅ Insert attendance
    await prisma.Attendance.create({
      data: {
        student_id: student.id,
        status,
      },
    });

    console.log("✅ Attendance saved:", student.name, status);

    // ✅ Send SMS    
    const nowTime = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (status === "entry") {
      await sendSMS(student.phone, "202168", `${student.name}|${nowTime}|`);
    } else {
      await sendSMS(student.phone, "202167", `${student.name}|${nowTime}|`);
    }

    return res.json({ ok: true, status, name: student.name });

  } catch (err) {
    console.error("API ERROR:", err);
    return res.json({ ok: false, msg: "SERVER_ERR" });
  }
});

app.listen(PORT, () => {
  console.log("✅ RFID API running on port", PORT);
});

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// =======================================
// ✅ API ROOT CHECK
// =======================================
app.get("/", (req, res) => {
  res.json({ ok: true, service: "RFID API" });
});


// =======================================
// ✅ GET STUDENT BY UID (ESP8266 uses this)
// =======================================
app.get("/uid/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;

    const student = await prisma.student.findUnique({
      where: { uid }
    });

    if (!student) {
      return res.json({ name: "", phone: "" });
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
// ESP8266 uses this to auto detect next action
// ===========================================
app.get("/status/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const latest = await prisma.attendanceLog.findFirst({
      where: { student: { name } },
      orderBy: { ts: "desc" }   // ✅ FIXED FIELD NAME "ts"
    });

    if (!latest) return res.send("None");  // first scan of day

    return res.send(latest.status);  // "Entry" or "Exit"

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).send("Server Error");
  }
});


// =======================================
// ✅ LOG ATTENDANCE FROM ESP8266
// =======================================
app.post("/log", async (req, res) => {
  try {
    const { name, status } = req.body;

    if (!name || !status)
      return res.status(400).send("Missing parameters");

    // Check if student exists
    const student = await prisma.student.findFirst({
      where: { name }
    });

    if (!student)
      return res.status(404).send("Unknown Student");

    // Insert the log
    await prisma.attendanceLog.create({
      data: {
        studentId: student.id,
        status: status
      }
    });

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

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// =====================
// ✅ Base Route
// =====================
app.get("/", (req, res) => {
  res.json({ ok: true, service: "RFID API" });
});


// =====================
// ✅ Get Student by UID
// =====================
app.get("/uid/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;

    const student = await prisma.student.findUnique({
      where: { uid }
    });

    if (!student) {
      return res.json({ name: "", phone: "" });
    }

    res.json({ name: student.name, phone: student.phone || "" });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


// ================================
// ✅ NEW — Last Status of Student
// For Auto Entry/Exit Detection
// ================================
app.get("/status/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const latest = await prisma.attendanceLog.findFirst({
      where: { student: { name } },
      orderBy: { timestamp: "desc" }
    });

    if (!latest) return res.send("None");   // No logs today

    return res.send(latest.status);         // "Entry" or "Exit"

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


// =====================
// ✅ Log Entry / Exit
// =====================
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

    await prisma.attendanceLog.create({
      data: {
        studentId: student.id,
        status: status
      }
    });

    res.send("Logged");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


// =====================
// ✅ Server Start
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ RFID API Running on Port ${PORT}`);
});

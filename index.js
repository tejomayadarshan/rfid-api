const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, service: "RFID API" });
});

// Get student by UID
app.get("/uid/:uid", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { uid: req.params.uid }
  });
  if (!student) return res.json({ name: "", phone: "" });
  res.json({ name: student.name, phone: student.phone || "" });
});

// Log Entry / Exit
app.post("/log", async (req, res) => {
  const { name, status } = req.body;
  if (!name || !status) return res.status(400).send("Missing parameters");

  const student = await prisma.student.findFirst({ where: { name } });
  if (!student) return res.status(404).send("Unknown Student");

  await prisma.attendanceLog.create({
    data: { studentId: student.id, status }
  });

  res.send("Logged");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`API running on ${PORT}`));

import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.resolve("data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Seuls les fichiers PDF sont acceptés")),
});

const app = express();
app.use(cors());
app.use(express.json());

// L'identifiant est le SHA-256 du PDF (hex) : même valeur que le diplomaHash on-chain
const ID_RE = /^[0-9a-f]{64}$/;

app.post("/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "PDF manquant (champ 'pdf')" });

  const id = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const dir = path.join(DATA_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "diploma.pdf"), req.file.buffer);

  const { studentName, title, year, mention } = req.body;
  const metadata = {
    id,
    studentName,
    title,
    year,
    mention,
    uploadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(metadata, null, 2));

  res.status(201).json({
    id,
    diplomaHash: `0x${id}`,
    metadataURI: `${BASE_URL}/diploma/${id}`,
  });
});

app.get("/diploma/:id", (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: "Identifiant invalide" });
  const file = path.join(DATA_DIR, id, "meta.json");
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Introuvable" });
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

app.get("/diploma/:id/pdf", (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return res.status(400).json({ error: "Identifiant invalide" });
  const file = path.join(DATA_DIR, id, "diploma.pdf");
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Introuvable" });
  res.sendFile(file);
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Serveur off-chain sur ${BASE_URL}`));
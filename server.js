import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
[uploadsDir, outputDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/convert', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const outputPath = path.join(outputDir, `${Date.now()}.mp3`);

  ffmpeg(req.file.path)
    .noVideo()
    .audioBitrate('192k')
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      const stats = fs.statSync(outputPath);
      res.json({
        success: true,
        filename: path.basename(outputPath),
        size: stats.size,
        downloadUrl: `/download/${path.basename(outputPath)}`
      });
    })
    .on('error', (err) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    })
    .save(outputPath);
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.download(filePath);
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
[uploadsDir, outputDir].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d));

const upload = multer({ dest: uploadsDir, limits: { fileSize: 500*1024*1024 } });

app.get('/', (req, res) => res.json({ status: 'oki' }));

app.post('/convert', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const out = path.join(outputDir, `${Date.now()}.mp3`);
  ffmpeg(req.file.path).noVideo().audioBitrate('192k')
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      res.json({ success: true, size: fs.statSync(out).size, downloadUrl: `/download/${path.basename(out)}` });
    })
    .on('error', (e) => {
      fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
      res.status(500).json({ error: e.message });
    })
    .save(out);
});

app.get('/download/:filename', (req, res) => {
  const f = path.join(outputDir, req.params.filename);
  fs.existsSync(f) ? res.download(f) : res.status(404).json({ error: 'Not found' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
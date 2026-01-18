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
[uploadsDir, outputDir].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d));

const upload = multer({ dest: uploadsDir, limits: { fileSize: 500*1024*1024 } });

app.get('/health', (req, res) => res.json({ status: 'OK', ffmpeg: 'ready' }));

app.post('/convert', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const out = path.join(outputDir, `${Date.now()}.mp3`);
  
  console.log('Converting:', req.file.path);

  ffmpeg(req.file.path)
    .noVideo()
    .audioBitrate('192k')
    .on('start', cmd => console.log('FFmpeg:', cmd))
    .on('end', () => {
      console.log('Done:', out);
      fs.unlinkSync(req.file.path);
      const s = fs.statSync(out);
      res.json({ 
        success: true, 
        filename: path.basename(out), 
        size: s.size, 
        downloadUrl: `/download/${path.basename(out)}` 
      });
    })
    .on('error', (e) => {
      console.error('FFmpeg Error:', e.message);
      fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
      res.status(500).json({ error: e.message });
    })
    .save(out);
});

app.get('/download/:filename', (req, res) => {
  const f = path.join(outputDir, req.params.filename);
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' });
  res.download(f);
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html not found');
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log('ENV:', process.env.NODE_ENV);
});
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import guidesRouter from './routes/guides';
import groupsRouter from './routes/groups';
import adminRouter from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { telemetry } from './utils/telemetry';
import { normalizeHttpRouteKey } from './utils/http_telemetry';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const processedDir = process.env.PROCESSED_DIR || './processed';
const dataDir = './data';
const modelsDir = './models';

[uploadDir, processedDir, dataDir, modelsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    try {
      const fullPath = (req.baseUrl || '') + (req.path || req.url || '');
      if (!fullPath.startsWith('/api')) {
        return;
      }
      const routeKey = normalizeHttpRouteKey(req.method, fullPath);
      telemetry.recordHttpLatency(routeKey, Date.now() - started);
    } catch {
      // ignore telemetry errors
    }
  });
  next();
});

app.use('/processed', express.static(path.resolve(processedDir)));
app.use('/uploads', express.static(path.resolve(uploadDir)));

app.use('/api/guides', guidesRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/admin', adminRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Pose Guide API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;

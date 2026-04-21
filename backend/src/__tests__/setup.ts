import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

process.env.DATABASE_PATH = ':memory:';
process.env.UPLOAD_DIR = path.resolve(__dirname, '../../test-uploads');
process.env.PROCESSED_DIR = path.resolve(__dirname, '../../test-processed');

const testDirs = [
  process.env.UPLOAD_DIR,
  process.env.PROCESSED_DIR,
];

beforeAll(() => {
  for (const dir of testDirs) {
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
});

afterAll(() => {
  for (const dir of testDirs) {
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import guidesRouter from '../routes/guides';
import { errorHandler } from '../middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/api/guides', guidesRouter);
app.use(errorHandler);

describe('Guides API', () => {
  describe('GET /api/guides', () => {
    it('should return empty list when no guides exist', async () => {
      const response = await request(app)
        .get('/api/guides')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.guides).toBeInstanceOf(Array);
      expect(response.body.data.page).toBe(1);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/guides?page=2&pageSize=5')
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.pageSize).toBe(5);
    });
  });

  describe('GET /api/guides/:id', () => {
    it('should return 404 for non-existent guide', async () => {
      const response = await request(app)
        .get('/api/guides/non-existent-id')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('DELETE /api/guides/:id', () => {
    it('should return 404 for non-existent guide', async () => {
      const response = await request(app)
        .delete('/api/guides/non-existent-id')
        .expect(404);

      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/guides', () => {
    it('should return 400 when no image is provided', async () => {
      const response = await request(app)
        .post('/api/guides')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('No image');
    });
  });
});

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Guide, GuideStatus, GuideLayers, GuideSettings, DEFAULT_SETTINGS } from '../models/guide';

const DB_PATH = process.env.DATABASE_PATH || './data/guides.db';

class GuidesRepository {
  private db: Database.Database;

  constructor() {
    const dbPath = path.resolve(DB_PATH);
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guides (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_image_url TEXT NOT NULL,
        guide_image_url TEXT,
        thumbnail_url TEXT,
        layers TEXT NOT NULL DEFAULT '{}',
        settings TEXT NOT NULL DEFAULT '{}',
        favorite INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        processing_error TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_guides_created_at ON guides(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status);
      CREATE INDEX IF NOT EXISTS idx_guides_favorite ON guides(favorite);
    `);
  }

  create(guide: Omit<Guide, 'updatedAt'>): Guide {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO guides (id, created_at, updated_at, source_image_url, guide_image_url, thumbnail_url, layers, settings, favorite, tags, status, processing_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      guide.id,
      guide.createdAt,
      now,
      guide.sourceImageUrl,
      guide.guideImageUrl || null,
      guide.thumbnailUrl || null,
      JSON.stringify(guide.layers),
      JSON.stringify(guide.settings),
      guide.favorite ? 1 : 0,
      JSON.stringify(guide.tags),
      guide.status,
      guide.processingError || null
    );

    return { ...guide, updatedAt: now };
  }

  findById(id: string): Guide | null {
    const stmt = this.db.prepare('SELECT * FROM guides WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToGuide(row) : null;
  }

  findAll(page: number = 1, pageSize: number = 20): { guides: Guide[]; total: number } {
    const offset = (page - 1) * pageSize;
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM guides');
    const { count } = countStmt.get() as { count: number };

    const stmt = this.db.prepare(`
      SELECT * FROM guides 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset) as any[];

    return {
      guides: rows.map(this.mapRowToGuide),
      total: count
    };
  }

  update(id: string, updates: Partial<Guide>): Guide | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updatedAt: now };

    const stmt = this.db.prepare(`
      UPDATE guides SET
        updated_at = ?,
        guide_image_url = ?,
        thumbnail_url = ?,
        layers = ?,
        settings = ?,
        favorite = ?,
        tags = ?,
        status = ?,
        processing_error = ?
      WHERE id = ?
    `);

    stmt.run(
      now,
      updated.guideImageUrl || null,
      updated.thumbnailUrl || null,
      JSON.stringify(updated.layers),
      JSON.stringify(updated.settings),
      updated.favorite ? 1 : 0,
      JSON.stringify(updated.tags),
      updated.status,
      updated.processingError || null,
      id
    );

    return updated;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM guides WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  updateStatus(id: string, status: GuideStatus, error?: string): void {
    const stmt = this.db.prepare(`
      UPDATE guides SET status = ?, processing_error = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(status, error || null, new Date().toISOString(), id);
  }

  private mapRowToGuide(row: any): Guide {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceImageUrl: row.source_image_url,
      guideImageUrl: row.guide_image_url || '',
      thumbnailUrl: row.thumbnail_url || '',
      layers: JSON.parse(row.layers) as GuideLayers,
      settings: { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) } as GuideSettings,
      favorite: Boolean(row.favorite),
      tags: JSON.parse(row.tags) as string[],
      status: row.status as GuideStatus,
      processingError: row.processing_error || undefined
    };
  }
}

export const guidesRepository = new GuidesRepository();

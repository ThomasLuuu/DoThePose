import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../models/group';

const DB_PATH = process.env.DATABASE_PATH || './data/guides.db';

class GroupsRepository {
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
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS guide_groups (
        guide_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (guide_id, group_id),
        FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_guide_groups_group ON guide_groups(group_id);
      CREATE INDEX IF NOT EXISTS idx_guide_groups_guide ON guide_groups(guide_id);
      CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at DESC);
    `);
  }

  create(name: string): Group {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(id, name, now, now);
    return { id, name, createdAt: now, updatedAt: now, guideCount: 0 };
  }

  findById(id: string): Group | null {
    const row = this.db.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM guide_groups gg WHERE gg.group_id = g.id) AS guide_count
       FROM groups g WHERE g.id = ?`,
    ).get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findAll(): Group[] {
    const rows = this.db.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM guide_groups gg WHERE gg.group_id = g.id) AS guide_count
       FROM groups g ORDER BY g.created_at ASC`,
    ).all() as any[];
    return rows.map(this.mapRow);
  }

  rename(id: string, name: string): Group | null {
    const existing = this.findById(id);
    if (!existing) { return null; }
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE groups SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, id);
    return { ...existing, name, updatedAt: now };
  }

  delete(id: string): boolean {
    const txn = this.db.transaction((groupId: string) => {
      this.db.prepare(`DELETE FROM guide_groups WHERE group_id = ?`).run(groupId);
      return this.db.prepare(`DELETE FROM groups WHERE id = ?`).run(groupId).changes;
    });
    return txn(id) > 0;
  }

  /** Remove a guide from every group it belonged to (called when the guide itself is deleted). */
  removeGuideFromAllGroups(guideId: string): void {
    this.db.prepare(`DELETE FROM guide_groups WHERE guide_id = ?`).run(guideId);
  }

  addGuides(groupId: string, guideIds: string[]): number {
    if (guideIds.length === 0) { return 0; }
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO guide_groups (guide_id, group_id, created_at) VALUES (?, ?, ?)`,
    );
    const txn = this.db.transaction((ids: string[]) => {
      let added = 0;
      for (const guideId of ids) {
        const res = stmt.run(guideId, groupId, now);
        added += res.changes;
      }
      return added;
    });
    return txn(guideIds);
  }

  removeGuides(groupId: string, guideIds: string[]): number {
    if (guideIds.length === 0) { return 0; }
    const stmt = this.db.prepare(
      `DELETE FROM guide_groups WHERE group_id = ? AND guide_id = ?`,
    );
    const txn = this.db.transaction((ids: string[]) => {
      let removed = 0;
      for (const guideId of ids) {
        const res = stmt.run(groupId, guideId);
        removed += res.changes;
      }
      return removed;
    });
    return txn(guideIds);
  }

  /** Group ids that a guide belongs to. */
  groupIdsForGuide(guideId: string): string[] {
    const rows = this.db.prepare(
      `SELECT group_id FROM guide_groups WHERE guide_id = ?`,
    ).all(guideId) as { group_id: string }[];
    return rows.map((r) => r.group_id);
  }

  /** Bulk variant — map of guide_id -> group_ids, for a set of guide ids. */
  groupIdsForGuides(guideIds: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>();
    if (guideIds.length === 0) { return result; }
    const placeholders = guideIds.map(() => '?').join(',');
    const rows = this.db.prepare(
      `SELECT guide_id, group_id FROM guide_groups WHERE guide_id IN (${placeholders})`,
    ).all(...guideIds) as { guide_id: string; group_id: string }[];
    for (const row of rows) {
      const list = result.get(row.guide_id) ?? [];
      list.push(row.group_id);
      result.set(row.guide_id, list);
    }
    return result;
  }

  /** Guide ids belonging to a group, ordered by guides.created_at DESC. */
  guideIdsInGroup(groupId: string, page: number, pageSize: number): { guideIds: string[]; total: number } {
    const offset = (page - 1) * pageSize;
    const { count } = this.db.prepare(
      `SELECT COUNT(*) AS count FROM guide_groups WHERE group_id = ?`,
    ).get(groupId) as { count: number };
    const rows = this.db.prepare(
      `SELECT gg.guide_id FROM guide_groups gg
       JOIN guides g ON g.id = gg.guide_id
       WHERE gg.group_id = ?
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
    ).all(groupId, pageSize, offset) as { guide_id: string }[];
    return { guideIds: rows.map((r) => r.guide_id), total: count };
  }

  /** Guide ids with no group membership, ordered by guides.created_at DESC. */
  unassignedGuideIds(page: number, pageSize: number): { guideIds: string[]; total: number } {
    const offset = (page - 1) * pageSize;
    const { count } = this.db.prepare(
      `SELECT COUNT(*) AS count FROM guides g
       WHERE NOT EXISTS (SELECT 1 FROM guide_groups gg WHERE gg.guide_id = g.id)`,
    ).get() as { count: number };
    const rows = this.db.prepare(
      `SELECT g.id FROM guides g
       WHERE NOT EXISTS (SELECT 1 FROM guide_groups gg WHERE gg.guide_id = g.id)
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
    ).all(pageSize, offset) as { id: string }[];
    return { guideIds: rows.map((r) => r.id), total: count };
  }

  unassignedCount(): number {
    const { count } = this.db.prepare(
      `SELECT COUNT(*) AS count FROM guides g
       WHERE NOT EXISTS (SELECT 1 FROM guide_groups gg WHERE gg.guide_id = g.id)`,
    ).get() as { count: number };
    return count;
  }

  private mapRow(row: any): Group {
    return {
      id: String(row.id),
      name: String(row.name),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      guideCount: Number(row.guide_count) || 0,
    };
  }
}

export const groupsRepository = new GroupsRepository();

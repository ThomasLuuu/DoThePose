import fs from 'fs';
import path from 'path';
import { guidesRepository } from '../repositories/guides_repository';

interface CleanupStats {
  deletedGuides: number;
  deletedFiles: number;
  freedSpaceMB: number;
}

class CleanupService {
  private uploadDir = process.env.UPLOAD_DIR || './uploads';
  private processedDir = process.env.PROCESSED_DIR || './processed';

  async cleanupFailedGuides(maxAgeHours: number = 24): Promise<CleanupStats> {
    const stats: CleanupStats = {
      deletedGuides: 0,
      deletedFiles: 0,
      freedSpaceMB: 0,
    };

    const { guides } = guidesRepository.findAll(1, 1000);
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const guide of guides) {
      if (guide.status === 'failed' && new Date(guide.createdAt) < cutoffTime) {
        const freedSpace = await this.deleteGuideFiles(guide.id, guide.sourceImageUrl);
        stats.freedSpaceMB += freedSpace;
        stats.deletedFiles += freedSpace > 0 ? 1 : 0;
        
        guidesRepository.delete(guide.id);
        stats.deletedGuides++;
      }
    }

    console.log(`Cleanup completed: ${stats.deletedGuides} guides, ${stats.deletedFiles} files, ${stats.freedSpaceMB.toFixed(2)}MB freed`);
    return stats;
  }

  async deleteGuideFiles(guideId: string, sourceImageUrl: string): Promise<number> {
    let totalSize = 0;

    const filesToDelete = [
      path.join(this.uploadDir, path.basename(sourceImageUrl)),
      path.join(this.processedDir, `${guideId}_guide.png`),
      path.join(this.processedDir, `${guideId}_thumb.png`),
    ];

    for (const filePath of filesToDelete) {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Failed to delete file ${filePath}:`, error);
      }
    }

    return totalSize / (1024 * 1024);
  }

  async cleanupOrphanedFiles(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      deletedGuides: 0,
      deletedFiles: 0,
      freedSpaceMB: 0,
    };

    const { guides } = guidesRepository.findAll(1, 10000);
    const guideIds = new Set(guides.map(g => g.id));

    for (const dir of [this.uploadDir, this.processedDir]) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === '.gitkeep') {
          continue;
        }

        const guideId = this.extractGuideIdFromFilename(file);
        if (guideId && !guideIds.has(guideId)) {
          const filePath = path.join(dir, file);
          try {
            const fileStats = fs.statSync(filePath);
            stats.freedSpaceMB += fileStats.size / (1024 * 1024);
            fs.unlinkSync(filePath);
            stats.deletedFiles++;
          } catch (error) {
            console.error(`Failed to delete orphaned file ${filePath}:`, error);
          }
        }
      }
    }

    console.log(`Orphan cleanup completed: ${stats.deletedFiles} files, ${stats.freedSpaceMB.toFixed(2)}MB freed`);
    return stats;
  }

  private extractGuideIdFromFilename(filename: string): string | null {
    const guidMatch = filename.match(/^([a-f0-9-]{36})/i);
    return guidMatch ? guidMatch[1] : null;
  }

  getStorageStats(): { uploadsMB: number; processedMB: number; totalMB: number } {
    const uploadsMB = this.getDirSize(this.uploadDir);
    const processedMB = this.getDirSize(this.processedDir);

    return {
      uploadsMB,
      processedMB,
      totalMB: uploadsMB + processedMB,
    };
  }

  private getDirSize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }

    let totalSize = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return totalSize / (1024 * 1024);
  }
}

export const cleanupService = new CleanupService();

import * as FileSystem from 'expo-file-system/legacy';

export const SAVED_DIR = `${FileSystem.documentDirectory}session_captures/`;

export interface SavedPhoto {
  id: string;
  uri: string;
  createdAt: number;
  filename: string;
}

const LIST_CACHE_TTL_MS = 2500;
let listCache: { photos: SavedPhoto[]; fetchedAt: number } | null = null;

export function invalidateSavedPhotosListCache(): void {
  listCache = null;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SAVED_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVED_DIR, { intermediates: true });
  }
}

export async function listSavedPhotos(opts?: { forceRefresh?: boolean }): Promise<SavedPhoto[]> {
  const forceRefresh = opts?.forceRefresh === true;
  const now = Date.now();
  if (!forceRefresh && listCache && now - listCache.fetchedAt < LIST_CACHE_TTL_MS) {
    return listCache.photos;
  }

  try {
    await ensureDir();
    const entries = await FileSystem.readDirectoryAsync(SAVED_DIR);
    const photos: SavedPhoto[] = [];

    for (const filename of entries) {
      if (!/\.(jpe?g|png|heic|webp)$/i.test(filename)) { continue; }
      const uri = `${SAVED_DIR}${filename}`;
      const info = await FileSystem.getInfoAsync(uri, { md5: false });
      const id = filename.replace(/\.[^.]+$/, '');
      const modTime = (info.exists && 'modificationTime' in info && info.modificationTime)
        ? (info.modificationTime as number) * 1000
        : Date.now();
      photos.push({ id, uri, createdAt: modTime, filename });
    }

    photos.sort((a, b) => b.createdAt - a.createdAt);
    listCache = { photos, fetchedAt: Date.now() };
    return photos;
  } catch {
    return [];
  }
}

export async function deleteSavedPhoto(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    invalidateSavedPhotosListCache();
    return true;
  } catch {
    return false;
  }
}

export async function clearAllSavedPhotos(): Promise<number> {
  try {
    invalidateSavedPhotosListCache();
    const photos = await listSavedPhotos({ forceRefresh: true });
    let deletedCount = 0;

    for (const photo of photos) {
      const deleted = await deleteSavedPhoto(photo.uri);
      if (deleted) {
        deletedCount += 1;
      }
    }

    invalidateSavedPhotosListCache();
    return deletedCount;
  } catch {
    return 0;
  }
}

export async function saveUriToAppStorage(sourceUri: string, id: string): Promise<string> {
  await ensureDir();
  const dest = `${SAVED_DIR}${id}.jpg`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }
  invalidateSavedPhotosListCache();
  return dest;
}

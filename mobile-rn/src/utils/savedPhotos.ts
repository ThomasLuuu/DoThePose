import * as FileSystem from 'expo-file-system/legacy';

export const SAVED_DIR = `${FileSystem.documentDirectory}session_captures/`;

export interface SavedPhoto {
  id: string;
  uri: string;
  createdAt: number;
  filename: string;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SAVED_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVED_DIR, { intermediates: true });
  }
}

export async function listSavedPhotos(): Promise<SavedPhoto[]> {
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
    return true;
  } catch {
    return false;
  }
}

export async function saveUriToAppStorage(sourceUri: string, id: string): Promise<string> {
  await ensureDir();
  const dest = `${SAVED_DIR}${id}.jpg`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }
  return dest;
}

const DB_NAME = 'zonestream_backdrop_media_v1';
const STORE_NAME = 'media';
const MEDIA_KEY = 'active_custom_backdrop';

export interface StoredBackdropMedia {
  blob: Blob;
  kind: 'image' | 'video';
  name: string;
  mimeType: string;
  updatedAt: number;
}

function openBackdropDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka penyimpanan lokal.'));
  });
}

export async function saveCustomBackdropBlob(
  file: File
): Promise<{ kind: 'image' | 'video'; name: string }> {
  const mime = String(file.type || '').toLowerCase();
  const isVideo =
    mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name);
  const isImage =
    mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name);

  if (!isVideo && !isImage) {
    throw new Error('Format tidak didukung. Pilih file Foto (JPG/PNG/WebP/GIF) atau Video (MP4/WebM).');
  }

  const maxBytes = isVideo ? 80 * 1024 * 1024 : 18 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      isVideo
        ? 'Ukuran video terlalu besar (maksimal 80 MB agar tetap ringan dan mulus).'
        : 'Ukuran foto terlalu besar (maksimal 18 MB).'
    );
  }

  const kind: 'image' | 'video' = isVideo ? 'video' : 'image';
  const db = await openBackdropDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const payload: StoredBackdropMedia = {
      blob: file,
      kind,
      name: file.name || (kind === 'video' ? 'video-latar.mp4' : 'foto-latar.jpg'),
      mimeType: mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      updatedAt: Date.now(),
    };
    store.put(payload, MEDIA_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan file latar ke browser.'));
  });
  db.close();

  return { kind, name: file.name || 'Latar Kustom' };
}

export async function loadCustomBackdropBlob(): Promise<StoredBackdropMedia | null> {
  try {
    const db = await openBackdropDb();
    const record = await new Promise<StoredBackdropMedia | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MEDIA_KEY);
      req.onsuccess = () => resolve((req.result as StoredBackdropMedia) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function clearCustomBackdropBlob(): Promise<void> {
  try {
    const db = await openBackdropDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(MEDIA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore cleanup errors
  }
}

export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith('data:video/')) return true;
  if (clean.startsWith('blob:')) return false;
  const withoutQuery = clean.split(/[?#]/)[0];
  return /\.(mp4|webm|mov|m4v|ogv)$/.test(withoutQuery);
}

export function sanitizeMediaUrl(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}

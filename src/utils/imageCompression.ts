import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';

export const MAX_CHAT_IMAGE_BYTES = 1024 * 1024; // Strict 1MB limit

export interface ImageCompressionOptions {
  maxSizeBytes?: number;
  maxDimension?: number;
  initialQuality?: number;
  minQuality?: number;
}

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  previewDataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  wasCompressed: boolean;
}

export interface ChatImageUploadResult {
  url: string;
  storagePath: string;
  uploadedToFirebase: boolean;
  compressed: CompressedImageResult;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
      .then((bitmap) => ({
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {
            // ignore
          }
        },
      }))
      .catch(() => loadHtmlImageElement(file));
  }
  return loadHtmlImageElement(file);
}

function loadHtmlImageElement(file: File): Promise<{
  source: HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('File gambar rusak atau format tidak didukung oleh browser.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function sanitizeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  return base || 'chat_image';
}

/**
 * Client-side image compression utility strictly capped at 1MB (1,048,576 bytes).
 * Preserves sharp visual quality for the chat feed using progressive quality steps
 * before gentle resolution downscaling only when needed.
 */
export async function compressImageForChat(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressedImageResult> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan gambar yang valid.');
  }

  const maxSizeBytes = Math.min(MAX_CHAT_IMAGE_BYTES, options.maxSizeBytes ?? MAX_CHAT_IMAGE_BYTES);
  const maxDimension = Math.max(480, options.maxDimension ?? 1600);
  const initialQuality = Math.min(0.95, Math.max(0.5, options.initialQuality ?? 0.9));
  const minQuality = Math.max(0.35, Math.min(initialQuality, options.minQuality ?? 0.5));

  // Keep animated GIF intact when already under 1MB
  if (file.type === 'image/gif' && file.size <= maxSizeBytes) {
    const previewDataUrl = await blobToDataUrl(file);
    return {
      file,
      blob: file,
      previewDataUrl,
      originalSize: file.size,
      compressedSize: file.size,
      width: 0,
      height: 0,
      mimeType: file.type,
      wasCompressed: false,
    };
  }

  const loaded = await loadImageElement(file);
  try {
    const origW = Math.max(1, loaded.width);
    const origH = Math.max(1, loaded.height);
    const maxSide = Math.max(origW, origH);

    // Small images already well under budget & within feed resolution don't need re-encoding
    if (file.size <= Math.min(350 * 1024, maxSizeBytes) && maxSide <= maxDimension) {
      const previewDataUrl = await blobToDataUrl(file);
      return {
        file,
        blob: file,
        previewDataUrl,
        originalSize: file.size,
        compressedSize: file.size,
        width: origW,
        height: origH,
        mimeType: file.type || 'image/jpeg',
        wasCompressed: false,
      };
    }

    // Prefer WebP for transparent PNG/WebP (keeps alpha & tight file size), JPEG for opaque photos
    const prefersAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const targetMime = prefersAlpha ? 'image/webp' : 'image/jpeg';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas browser tidak tersedia untuk kompresi gambar.');
    }

    let currentMaxDim = Math.min(maxSide, maxDimension);
    let bestBlob: Blob | null = null;
    let bestWidth = origW;
    let bestHeight = origH;
    let resolvedMime = targetMime;

    for (let dimPass = 0; dimPass < 5; dimPass += 1) {
      const scale = Math.min(1, currentMaxDim / maxSide);
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.clearRect(0, 0, targetW, targetH);
      if (resolvedMime === 'image/jpeg') {
        ctx.fillStyle = '#0F1118';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loaded.source, 0, 0, targetW, targetH);

      const startQ = dimPass === 0 ? initialQuality : 0.84;
      const qualitySteps: number[] = [];
      for (let q = startQ; q >= minQuality - 0.001; q -= 0.07) {
        qualitySteps.push(Number(Math.max(minQuality, q).toFixed(2)));
      }

      for (const q of qualitySteps) {
        let encoded = await canvasToBlob(canvas, resolvedMime, q);
        if (!encoded && resolvedMime !== 'image/jpeg') {
          resolvedMime = 'image/jpeg';
          encoded = await canvasToBlob(canvas, resolvedMime, q);
        }
        if (!encoded) continue;

        if (!bestBlob || encoded.size < bestBlob.size) {
          bestBlob = encoded;
          bestWidth = targetW;
          bestHeight = targetH;
        }

        if (encoded.size <= maxSizeBytes) {
          bestBlob = encoded;
          bestWidth = targetW;
          bestHeight = targetH;
          break;
        }
      }

      if (bestBlob && bestBlob.size <= maxSizeBytes) {
        break;
      }

      // Gently reduce dimensions for the next pass to avoid blurry low-quality artifacts
      currentMaxDim = Math.max(360, Math.round(currentMaxDim * 0.76));
    }

    if (!bestBlob) {
      throw new Error('Gagal mengompresi gambar.');
    }

    if (bestBlob.size > maxSizeBytes) {
      throw new Error(
        `Ukuran gambar setelah kompresi (${formatFileSize(bestBlob.size)}) masih melebihi batas 1MB.`
      );
    }

    const ext = resolvedMime === 'image/webp' ? 'webp' : 'jpg';
    const compressedFile = new File(
      [bestBlob],
      `${sanitizeBaseName(file.name)}.${ext}`,
      { type: resolvedMime, lastModified: Date.now() }
    );
    const previewDataUrl = await blobToDataUrl(bestBlob);

    return {
      file: compressedFile,
      blob: bestBlob,
      previewDataUrl,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      width: bestWidth,
      height: bestHeight,
      mimeType: resolvedMime,
      wasCompressed: true,
    };
  } finally {
    loaded.cleanup();
  }
}

/**
 * Compresses a chat image to <= 1MB on the client and uploads it to Firebase Storage.
 * Falls back cleanly to the compressed <= 1MB data URL if Firebase Storage rules/network
 * block browser uploads in local preview environments.
 */
export async function uploadCompressedChatImage(
  file: File,
  uid: string,
  onProgress?: (pct: number) => void
): Promise<ChatImageUploadResult> {
  onProgress?.(5);
  const compressed = await compressImageForChat(file, {
    maxSizeBytes: MAX_CHAT_IMAGE_BYTES,
    maxDimension: 1600,
    initialQuality: 0.9,
    minQuality: 0.5,
  });

  if (compressed.file.size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error('Gambar melebihi batas maksimal 1MB.');
  }

  onProgress?.(20);
  const safeUid = String(uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = compressed.mimeType === 'image/webp' ? 'webp' : compressed.mimeType === 'image/gif' ? 'gif' : 'jpg';
  const storagePath = `chat-media/${safeUid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, storagePath);

  try {
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, compressed.file, {
        contentType: compressed.mimeType,
        customMetadata: {
          uid: safeUid,
          originalSize: String(compressed.originalSize),
          compressedSize: String(compressed.compressedSize),
        },
      });

      const timeoutId = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch {
          // ignore
        }
        reject(new Error('Upload Firebase Storage timeout'));
      }, 12000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = 20 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 80);
            onProgress?.(Math.min(99, pct));
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          clearTimeout(timeoutId);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    return {
      url: downloadUrl,
      storagePath,
      uploadedToFirebase: true,
      compressed,
    };
  } catch (err) {
    console.warn('[Chat Image] Firebase Storage upload fallback triggered:', err);
    onProgress?.(100);
    return {
      url: compressed.previewDataUrl,
      storagePath,
      uploadedToFirebase: false,
      compressed,
    };
  }
}

/**
 * Compresses a payment receipt / bukti transfer image to <= 800KB and uploads to Firebase Storage
 * (`payment-proofs/{uid}/{orderId}-...`), with automatic fallback to compressed data URL.
 */
export async function uploadPaymentProofImage(
  file: File,
  uid: string,
  orderId: string,
  onProgress?: (pct: number) => void
): Promise<ChatImageUploadResult> {
  onProgress?.(10);
  const compressed = await compressImageForChat(file, {
    maxSizeBytes: 800 * 1024,
    maxDimension: 1400,
    initialQuality: 0.88,
    minQuality: 0.5,
  });

  if (compressed.width < 80 || compressed.height < 80) {
    throw new Error('Resolusi foto bukti transfer terlalu kecil atau tidak terbaca.');
  }

  onProgress?.(30);
  const safeUid = String(uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeOrder = String(orderId || 'order').replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `payment-proofs/${safeUid}/${safeOrder}-${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  try {
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, compressed.file, {
        contentType: compressed.mimeType,
        customMetadata: {
          uid: safeUid,
          orderId: safeOrder,
          originalSize: String(compressed.originalSize),
          compressedSize: String(compressed.compressedSize),
        },
      });

      const timeoutId = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch {
          // ignore
        }
        reject(new Error('Upload Firebase Storage timeout'));
      }, 9000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = 30 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 65);
            onProgress?.(Math.min(98, pct));
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          clearTimeout(timeoutId);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    return {
      url: downloadUrl,
      storagePath,
      uploadedToFirebase: true,
      compressed,
    };
  } catch {
    onProgress?.(100);
    return {
      url: compressed.previewDataUrl,
      storagePath,
      uploadedToFirebase: false,
      compressed,
    };
  }
}

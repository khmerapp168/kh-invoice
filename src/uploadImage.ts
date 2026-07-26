/**
 * Shared helper for every "upload a photo" flow in the app (avatar, QR
 * codes, payment proof, invoice item photos, ...).
 *
 * Why this exists:
 * - Phone camera photos are often 3-15MB and some iPhones save them as
 *   HEIC, which most Android/desktop browsers cannot render in an <img>
 *   tag even after a successful upload (the file looks "broken").
 * - Large files are slow (or time out) on the mobile data connections
 *   most users of this app are on, which looks like "upload doesn't
 *   work" even though it eventually would.
 *
 * `prepareImageForUpload` re-encodes any selected image to a
 * reasonably-sized JPEG on the client (via <canvas>) before it's sent to
 * Supabase Storage. This fixes both problems at once and keeps uploads
 * fast and reliable everywhere in the app.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB hard cap before we even try to compress

export class UploadValidationError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image file'));
    img.src = src;
  });
}

/**
 * Validates and compresses an image file for upload.
 * Throws UploadValidationError with a friendly message on invalid input.
 */
export async function prepareImageForUpload(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1440;
  const quality = opts.quality ?? 0.82;

  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!isImage) {
    throw new UploadValidationError('Please choose an image file (JPG, PNG, or WEBP).');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError('That image is too large (max 8MB). Please choose a smaller photo.');
  }

  // HEIC/HEIF can't be decoded by <canvas> in most browsers - upload as-is
  // and let Supabase store it; the caller should show a warning that
  // preview may not work on all devices. Everything else gets compressed.
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (isHeic) {
    return file;
  }

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });

    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    // If anything about compression fails, fall back to the original file
    // rather than blocking the upload entirely.
    return file;
  }
}

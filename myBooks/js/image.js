// Resize and compress a cover in the browser before uploading.

const LARGE_WIDTH = 900;
const SMALL_WIDTH = 360;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(source, srcW, srcH, width) {
  // Halve repeatedly first: one big downscale step looks soft/aliased.
  let current = source;
  let w = srcW;
  let h = srcH;
  while (w / 2 >= width) {
    const step = document.createElement('canvas');
    step.width = Math.round(w / 2);
    step.height = Math.round(h / 2);
    step.getContext('2d').drawImage(current, 0, 0, step.width, step.height);
    current = step;
    w = step.width;
    h = step.height;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, w);
  canvas.height = Math.round((canvas.width / srcW) * srcH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encode(canvas, quality) {
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return webp;
  return toBlob(canvas, 'image/jpeg', quality); // browsers without WebP encoding
}

/** Returns { large, small, ext, type, previewUrl } ready for uploadCover(). */
export async function prepareCover(file) {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large (30 MB max).');
  let image;
  try {
    image = await decode(file);
  } catch {
    throw new Error('Couldn’t read that image. Try a JPG, PNG or WebP file.');
  }
  const w = image.width;
  const h = image.height;
  const large = await encode(draw(image, w, h, LARGE_WIDTH), 0.84);
  const small = await encode(draw(image, w, h, SMALL_WIDTH), 0.8);
  image.close?.();
  if (!large || !small) throw new Error('Couldn’t process that image.');
  const type = large.type;
  return {
    large,
    small: small.type === type ? small : large,
    type,
    ext: type === 'image/webp' ? 'webp' : 'jpg',
    previewUrl: URL.createObjectURL(large),
  };
}

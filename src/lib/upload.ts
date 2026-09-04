import api from "./api";

export interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  altText?: string | null;
  cloudinaryPublicId: string;
  uploadedById?: string | null;
  isDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hard ceiling on the body we are allowed to put on the wire.
 *
 * The deployed backend sits behind Vercel, whose platform edge drops any
 * request body over ~1.15 MB *before* Nest ever runs. It answers with a
 * plain-text "The deployment is currently unavailable / SERVICE_UNAVAILABLE"
 * page — no JSON, so nothing downstream can explain what went wrong. A camera
 * or stock photo (e.g. 5760x3840) is several MB and hits this every time.
 *
 * So: shrink below the ceiling here, and if we still cannot, say so plainly
 * instead of letting the request die at the edge.
 */
export const MAX_UPLOAD_BYTES = 1_000_000; // ~0.95 MB, comfortably under the edge limit

/** Longest edge we keep. Item thumbnails and avatars never need more. */
const MAX_IMAGE_EDGE = 1600;

/** Extensions the backend maps to a fileType. Anything else is rejected there. */
const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const ACCEPTED_IMAGE_LABEL = "JPG, PNG, GIF or WebP";

/** Canvas cannot re-encode these without destroying them (animation / vectors). */
const NO_RECOMPRESS = new Set(["image/gif", "image/svg+xml"]);

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Human label for whatever the user actually picked, for the error message. */
const describeFile = (file: File): string => {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase() : "";
  if (ext) return `a ${ext} file`;
  if (file.type) return `a ${file.type} file`;
  return "an unrecognised file";
};

/**
 * Returns a specific, user-facing reason the file cannot be uploaded, or null
 * when it is fine. Checked before any network call so the user gets the real
 * cause instead of a generic failure.
 */
export function validateImageFile(file: File): string | null {
  if (file.size === 0) {
    return `"${file.name}" is empty (0 bytes). Please pick a different file.`;
  }
  if (!IMAGE_MIME_EXT[file.type]) {
    return `"${file.name}" is ${describeFile(file)}. Item images must be ${ACCEPTED_IMAGE_LABEL}.`;
  }
  return null;
}

/** Swap the filename extension so it matches the bytes we are actually sending. */
const withExtension = (name: string, ext: string): string => {
  const stem = name.replace(/\.[^.]+$/, "") || "image";
  return `${stem}.${ext}`;
};

type Decoded = { width: number; height: number; source: CanvasImageSource; release: () => void };

const decodeImage = async (file: File): Promise<Decoded> => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/**
 * Downscale + re-encode so the upload fits under MAX_UPLOAD_BYTES.
 *
 * Returns the original file untouched when it already fits, when it is a
 * format we must not re-encode, or when decoding fails for any reason — the
 * size guard in uploadFile is what actually enforces the limit, this only
 * tries to make the file pass it.
 */
export async function compressImage(file: File): Promise<File> {
  if (NO_RECOMPRESS.has(file.type)) return file;

  let decoded: Decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    return file; // let the size check produce the message
  }

  try {
    // Already small enough and already a sane size — leave it exactly as it
    // is. Re-encoding here would flatten a transparent PNG onto white for no
    // gain, so only oversized images get rewritten as JPEG.
    if (
      file.size <= MAX_UPLOAD_BYTES &&
      Math.max(decoded.width, decoded.height) <= MAX_IMAGE_EDGE
    ) {
      return file;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Never upscale — a small image stays exactly as big as it was.
    let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height));

    // Shrink, then step quality down, then step size down again if a very
    // detailed photo still will not fit.
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // JPEG has no alpha; paint white so transparent PNGs do not go black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.75, 0.65]) {
        const blob = await canvasToBlob(canvas, quality);
        if (!blob) return file;
        if (blob.size <= MAX_UPLOAD_BYTES) {
          // Re-encoding a tiny image can make it bigger; keep the smaller one.
          if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) return file;
          return new File([blob], withExtension(file.name, "jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }
      scale *= 0.75;
    }
    return file;
  } finally {
    decoded.release();
  }
}

/**
 * Turn a failed upload into something that names the actual cause.
 *
 * The edge rejections (413 / 502 / 503 with an HTML or plain-text body) carry
 * no JSON `message`, which is exactly why they used to surface as a bare
 * "Image upload failed".
 */
export function getUploadErrorMessage(err: unknown, fileName?: string): string {
  const error = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const named = fileName ? `"${fileName}"` : "This file";
  const status = error?.response?.status;
  const data = error?.response?.data as { message?: unknown } | undefined;

  const rawMessage = data?.message;
  const apiMessage =
    Array.isArray(rawMessage) && rawMessage.length
      ? String(rawMessage[0])
      : typeof rawMessage === "string" && rawMessage
        ? rawMessage
        : null;

  if (status === 413) {
    return `${named} is too large for the server to accept. Please use an image under ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  // Vercel drops oversized bodies at the edge and answers 502/503 with a
  // plain-text page — no JSON message to read, so name the likely cause.
  if ((status === 502 || status === 503) && !apiMessage) {
    return `${named} was rejected by the server, most likely because it is too large. Please use an image under ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  if (apiMessage) return apiMessage;
  if (status === 401) return "Your session expired. Please sign in again and retry the upload.";
  if (error?.code === "ECONNABORTED") return "The upload timed out. Check your connection and try again.";
  if (error?.code === "ERR_NETWORK") return "Could not reach the server. Check your connection and try again.";
  return "Image upload failed. Please try again.";
}

/**
 * POST /upload — returns the full media_files DB record. Store the returned id
 * as the FK in your payload.
 *
 * Validates the type, shrinks the image under the wire limit, and throws an
 * Error whose message is safe to show the user.
 */
export const uploadFile = async (file: File): Promise<MediaFile> => {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const prepared = await compressImage(file);

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatBytes(prepared.size)}${
        prepared.size < file.size ? ` even after compression (was ${formatBytes(file.size)})` : ""
      }. The server only accepts images up to ${formatBytes(MAX_UPLOAD_BYTES)} — please resize or use a smaller image.`,
    );
  }

  const form = new FormData();
  form.append("file", prepared, prepared.name);

  try {
    const res = await api.post<MediaFile>("/upload", form, {
      headers: { "Content-Type": undefined },
      timeout: 60_000,
    });
    return res.data;
  } catch (err) {
    throw new Error(getUploadErrorMessage(err, file.name));
  }
};

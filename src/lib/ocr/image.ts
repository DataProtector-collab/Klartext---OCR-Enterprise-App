export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;
export const MAX_DATA_URL_CHARS = 3_500_000;

export type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
};

export async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte ein Bild wählen (JPG, PNG oder WEBP).");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Dieses Bildformat wird nicht unterstützt.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht gelesen werden.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error("Das Bild ist zu groß. Bitte ein kleineres Foto wählen.");
  }
  return { dataUrl, width, height, name: file.name || "bild.jpg" };
}

export async function prepareImageFromUrl(url: string, name: string): Promise<PreparedImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Beispielbild konnte nicht geladen werden.");
  const blob = await res.blob();
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  return prepareImageFile(file);
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

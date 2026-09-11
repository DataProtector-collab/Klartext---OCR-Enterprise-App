import { JPEG_QUALITY, MAX_DATA_URL_CHARS, MAX_EDGE, type PreparedImage } from "./image";

export const MAX_PAGES = 20;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function renderPdfPages(
  file: File,
  remaining: number,
): Promise<{ pages: PreparedImage[]; totalInFile: number; truncated: boolean }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const totalInFile = doc.numPages;
  const take = Math.min(totalInFile, Math.max(0, remaining));
  const pages: PreparedImage[] = [];
  const base = file.name.replace(/\.pdf$/i, "") || "PDF";

  for (let i = 1; i <= take; i++) {
    const page = await doc.getPage(i);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_EDGE / Math.max(unscaled.width, unscaled.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF-Seite konnte nicht gerendert werden.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error(`Seite ${i} von ${base} ist zu groß.`);
    }
    pages.push({
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      name: `${base} · Seite ${i}`,
    });
  }

  return { pages, totalInFile, truncated: take < totalInFile };
}

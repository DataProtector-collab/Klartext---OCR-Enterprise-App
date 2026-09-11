import { prepareImageFile, type PreparedImage } from "./image";
import { isPdfFile, MAX_PAGES, renderPdfPages } from "./pdf";
import type { OcrResult } from "./types";

export type PageStatus = "ready" | "scanning" | "done" | "error";

export type SourcePage = {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  label: string;
  sourceName: string;
  status: PageStatus;
  error?: string;
  result?: OcrResult;
};

export { MAX_PAGES };

function fromPrepared(img: PreparedImage, sourceName: string): SourcePage {
  return {
    id: crypto.randomUUID(),
    dataUrl: img.dataUrl,
    width: img.width,
    height: img.height,
    label: img.name,
    sourceName,
    status: "ready",
  };
}

export async function filesToPages(
  files: File[],
  existingCount: number,
): Promise<{ pages: SourcePage[]; warning?: string }> {
  const remainingStart = MAX_PAGES - existingCount;
  if (remainingStart <= 0) {
    throw new Error(`Maximal ${MAX_PAGES} Seiten pro Vorgang.`);
  }

  const out: SourcePage[] = [];
  let slots = remainingStart;
  const skipped: string[] = [];
  let warning: string | undefined;

  for (const file of files) {
    if (slots <= 0) {
      warning = `Maximal ${MAX_PAGES} Seiten. Weitere Dateien wurden übersprungen.`;
      break;
    }
    if (isPdfFile(file)) {
      try {
        const rendered = await renderPdfPages(file, slots);
        for (const img of rendered.pages) {
          out.push(fromPrepared(img, file.name));
        }
        slots -= rendered.pages.length;
        if (rendered.truncated) {
          warning = `${file.name} hat ${rendered.totalInFile} Seiten. Die ersten ${rendered.pages.length} werden gelesen.`;
        }
      } catch {
        throw new Error(`${file.name} konnte nicht als PDF gelesen werden.`);
      }
      continue;
    }
    if (file.type.startsWith("image/")) {
      const img = await prepareImageFile(file);
      out.push(fromPrepared(img, file.name));
      slots -= 1;
      continue;
    }
    skipped.push(file.name || "unbekannte Datei");
  }

  if (!out.length) {
    throw new Error(
      skipped.length
        ? "Keine lesbaren Dateien. PDF, JPG, PNG oder WEBP wählen."
        : "Bitte ein PDF oder Bilder wählen.",
    );
  }
  if (skipped.length && !warning) {
    warning = `Übersprungen: ${skipped.slice(0, 3).join(", ")}`;
  }
  return { pages: out, warning };
}

export function combinePages(pages: SourcePage[]): OcrResult | null {
  const done = pages.filter((p) => p.result);
  if (!done.length) return null;
  const multi = pages.length > 1;
  const title =
    done[0]?.result?.title && pages.length === 1
      ? done[0].result.title
      : pages[0]?.sourceName.replace(/\.[^.]+$/, "") || "Dokument";
  const language = done[0]?.result?.language ?? "und";
  const text = pages
    .map((page, i) => {
      const body = page.result?.text ?? (page.error ? `[${page.error}]` : "");
      if (!body) return "";
      if (!multi) return body;
      return `—— Seite ${i + 1} ——\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const markdown = pages
    .map((page, i) => {
      const body = page.result?.markdown ?? page.result?.text ?? (page.error ? `*${page.error}*` : "");
      if (!body) return "";
      if (!multi) return body;
      return `## Seite ${i + 1}\n\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
  return { title, language, text, markdown };
}

export function sourceLabel(pages: SourcePage[]): string {
  if (!pages.length) return "Dokument";
  const names = [...new Set(pages.map((p) => p.sourceName))];
  if (names.length === 1) {
    return pages.length > 1 ? `${names[0]} · ${pages.length} Seiten` : names[0];
  }
  return `${names.length} Dateien · ${pages.length} Seiten`;
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { OcrResult } from "./types";

const ExtractInput = z.object({
  imageDataUrl: z.string().min(32).max(5_000_000),
  mode: z.enum(["text", "layout", "table", "receipt"]),
  language: z.string().min(2).max(8),
  pageIndex: z.number().int().min(0).max(200).optional(),
  pageCount: z.number().int().min(1).max(200).optional(),
});

const MODE_INSTRUCTIONS: Record<string, string> = {
  text: "Extract ALL visible text as plain text. Preserve original line breaks and reading order. Do not translate. Do not summarize.",
  layout:
    "Extract ALL visible text and reconstruct the document structure as Markdown (headings, lists, blockquotes, emphasis). Preserve reading order. Do not translate.",
  table:
    "Extract ALL visible text. Render tables as GitHub-flavored Markdown tables. Keep non-table text as paragraphs around them. Do not translate.",
  receipt:
    "This is a receipt, invoice, or ticket. Extract merchant, date, line items, subtotal, tax, total, and any IDs. Return a clean Markdown document with a heading and a table of items, then totals. Do not invent missing numbers.",
};

function buildPrompt(mode: string, language: string, pageIndex?: number, pageCount?: number): string {
  const lang =
    language === "auto"
      ? "Detect the document language. Keep the original script (Latin, CJK, Arabic, Cyrillic, etc.)."
      : language === "ja"
        ? "The document is Japanese. Extract the original 漢字 / ひらがな / カタカナ / Latin as written. Do not translate into German or English. Vertical columns read top-to-bottom, right-to-left."
        : language === "zh"
          ? "The document is Chinese (simplified or traditional). Extract the original 汉字 as written. Do not translate into German or English. Vertical columns read top-to-bottom, right-to-left."
          : `The document language is likely "${language}". Prefer that script; still extract other scripts if present. Do not translate.`;
  const page =
    pageCount && pageCount > 1 && pageIndex != null
      ? `This is page ${pageIndex + 1} of ${pageCount} of one document. Extract this page only.`
      : "";
  return [
    "You are a professional OCR engine. Read the image carefully at high detail.",
    MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.text,
    lang,
    page,
    "Ignore watermarks, UI chrome, and camera artifacts.",
    "If the image has no readable text, set text and markdown to an empty string and title to \"Kein Text\".",
    "Return ONLY valid JSON with this exact shape:",
    '{"title":"short 3-8 word title in the document language","language":"ISO-639-1 code","text":"full plain text","markdown":"markdown version"}',
    "No markdown fences. No commentary.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseResult(raw: string): OcrResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : trimmed).trim();
  try {
    const parsed = JSON.parse(jsonText) as Partial<OcrResult>;
    const text = typeof parsed.text === "string" ? parsed.text : trimmed;
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Dokument",
      language: typeof parsed.language === "string" ? parsed.language : "und",
      text,
      markdown:
        typeof parsed.markdown === "string" && parsed.markdown.trim()
          ? parsed.markdown
          : text,
    };
  } catch {
    return { title: "Dokument", language: "und", text: trimmed, markdown: trimmed };
  }
}

function extractTextFromResponse(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const rec = body as Record<string, unknown>;

  const outputText = rec.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText;

  const output = rec.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const p = part as { type?: string; text?: string };
        if (typeof p.text === "string") chunks.push(p.text);
      }
    }
    if (chunks.length) return chunks.join("\n");
  }

  const choices = rec.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as { message?: { content?: unknown } }).message;
    if (msg && typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg?.content)) {
      return msg.content
        .map((p) =>
          p && typeof p === "object" && "text" in p
            ? String((p as { text?: unknown }).text ?? "")
            : "",
        )
        .join("\n");
    }
  }

  return "";
}

function apiErrorMessage(status: number, body: unknown): string {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof rec.code === "string" ? rec.code : "";
  const nested = rec.error;
  const msg =
    typeof nested === "string"
      ? nested
      : nested && typeof nested === "object" && "message" in nested
        ? String((nested as { message?: unknown }).message ?? "")
        : typeof rec.message === "string"
          ? rec.message
          : "";
  if (
    status === 429 ||
    code.includes("spending-limit") ||
    /credits|quota|rate limit|subscription/i.test(msg)
  ) {
    return "Texterkennung ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.";
  }
  return msg || `Texterkennung fehlgeschlagen (${status}).`;
}

async function callResponsesApi(apiKey: string, imageDataUrl: string, prompt: string) {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50_000),
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_output_tokens: 6000,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
            { type: "input_text", text: prompt },
          ],
        },
      ],
    }),
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) throw new Error(apiErrorMessage(res.status, body));
  return extractTextFromResponse(body);
}

async function callChatCompletions(apiKey: string, imageDataUrl: string, prompt: string) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(50_000),
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_tokens: 6000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) throw new Error(apiErrorMessage(res.status, body));
  return extractTextFromResponse(body);
}

export const extractText = createServerFn({ method: "POST" })
  .validator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; result: OcrResult } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Texterkennung ist in dieser Umgebung nicht verfügbar." };
    }
    if (!data.imageDataUrl.startsWith("data:image/")) {
      return { ok: false, error: "Ungültiges Bild." };
    }

    const prompt = buildPrompt(data.mode, data.language, data.pageIndex, data.pageCount);
    try {
      let raw = "";
      try {
        raw = await callResponsesApi(apiKey, data.imageDataUrl, prompt);
      } catch {
        raw = await callChatCompletions(apiKey, data.imageDataUrl, prompt);
      }
      if (!raw.trim()) {
        return { ok: false, error: "Keine Antwort von der Texterkennung." };
      }
      return { ok: true, result: parseResult(raw) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Texterkennung fehlgeschlagen.";
      return { ok: false, error: message };
    }
  });

export const translateText = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(80_000),
        target: z.enum(["de", "en", "fr", "es", "it"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Übersetzung ist nicht verfügbar." };
    const labels: Record<string, string> = {
      de: "German",
      en: "English",
      fr: "French",
      es: "Spanish",
      it: "Italian",
    };
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 8000,
          messages: [
            {
              role: "system",
              content:
                "Translate the user's document. Preserve line breaks, lists, tables, and page markers like '—— Seite n ——'. Return only the translation.",
            },
            {
              role: "user",
              content: `Translate into ${labels[data.target]}:\n\n${data.text}`,
            },
          ],
        }),
      });
      const body = (await res.json()) as unknown;
      if (!res.ok) return { ok: false, error: `Übersetzung fehlgeschlagen (${res.status}).` };
      const text = extractTextFromResponse(body).trim();
      if (!text) return { ok: false, error: "Leere Übersetzung." };
      return { ok: true, text };
    } catch {
      return { ok: false, error: "Übersetzung fehlgeschlagen." };
    }
  });

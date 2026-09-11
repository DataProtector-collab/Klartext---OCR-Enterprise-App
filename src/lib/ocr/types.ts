export const OCR_MODES = ["text", "layout", "table", "receipt"] as const;
export type OcrMode = (typeof OCR_MODES)[number];

export const OCR_LANGUAGES = [
  { id: "auto", label: "Automatisch" },
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "it", label: "Italiano" },
  { id: "pt", label: "Português" },
  { id: "nl", label: "Nederlands" },
  { id: "pl", label: "Polski" },
  { id: "tr", label: "Türkçe" },
  { id: "ru", label: "Русский" },
  { id: "zh", label: "中文 · Chinesisch" },
  { id: "ja", label: "日本語 · Japanisch" },
  { id: "ar", label: "العربية" },
] as const;

export type OcrLanguage = (typeof OCR_LANGUAGES)[number]["id"];

export type OcrResult = {
  title: string;
  language: string;
  text: string;
  markdown: string;
};

export type ScanRow = {
  id: number;
  title: string;
  mode: OcrMode;
  language: string;
  sourceName: string;
  text: string;
  markdown: string;
  createdAt: string;
};

export const MODE_META: Record<
  OcrMode,
  { label: string; hint: string }
> = {
  text: { label: "Text", hint: "Reiner Fließtext, Zeilenumbrüche bleiben" },
  layout: { label: "Layout", hint: "Überschriften, Listen, Absätze als Markdown" },
  table: { label: "Tabelle", hint: "Tabellen und Spalten strukturiert" },
  receipt: { label: "Beleg", hint: "Rechnungen, Quittungen, Summen" },
};

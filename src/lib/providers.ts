import type { Cue } from "./subtitles";

export type ProviderId = "chrome" | "mymemory" | "openai" | "anthropic" | "gemini" | "openrouter" | "google" | "libretranslate";
export type TranslationStyle = "natural" | "cinematic" | "literal";

export type TranslateOptions = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  endpoint: string;
  sourceLanguage: string;
  sourceName: string;
  targetLanguage: string;
  targetName: string;
  style: TranslationStyle;
  cues: Cue[];
  onProgress: (completed: number, total: number) => void;
};

export const providers: Record<ProviderId, { name: string; badge: string; needsKey: boolean; defaultModel: string; description: string }> = {
  chrome: { name: "Chrome on-device", badge: "FREE", needsKey: false, defaultModel: "", description: "Private and free; desktop Chrome and supported language pairs only." },
  mymemory: { name: "MyMemory", badge: "FREE · LIMITED", needsKey: false, defaultModel: "", description: "No key. A limited public translation-memory service for smaller files." },
  gemini: { name: "Google Gemini", badge: "API KEY", needsKey: true, defaultModel: "gemini-2.5-flash-lite", description: "Fast AI translation; Google AI Studio offers a free developer tier." },
  openai: { name: "OpenAI", badge: "API KEY", needsKey: true, defaultModel: "gpt-5.4-nano", description: "Structured subtitle translation with your OpenAI model." },
  anthropic: { name: "Anthropic Claude", badge: "API KEY", needsKey: true, defaultModel: "claude-haiku-4-5", description: "Natural dialogue translation with Claude." },
  openrouter: { name: "OpenRouter", badge: "API KEY", needsKey: true, defaultModel: "openrouter/auto", description: "Use many different models through one compatible API." },
  google: { name: "Google Cloud Translate", badge: "500K/MO FREE", needsKey: true, defaultModel: "", description: "Official NMT translation; first 500K characters monthly are free." },
  libretranslate: { name: "LibreTranslate", badge: "SELF-HOST", needsKey: false, defaultModel: "", description: "Open-source translation. Point it at your own server for unrestricted use." },
};

const schema = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "integer" }, text: { type: "string" } },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
};

function styleInstruction(style: TranslationStyle) {
  if (style === "cinematic") return "Use polished, expressive cinematic dialogue while staying concise and believable.";
  if (style === "literal") return "Stay close to the original wording while using correct grammar in the target language.";
  return "Use natural, contemporary language that sounds native and is easy to read quickly.";
}

function systemPrompt(options: TranslateOptions) {
  return [
    `You are a professional audiovisual translator. Translate subtitle dialogue from ${options.sourceName} to ${options.targetName}.`,
    styleInstruction(options.style),
    "If the source language is Auto-detect, identify it from the text.",
    "Preserve each numeric id exactly and return one translation per input item in the same order.",
    "Never add timestamps, explanations, transliteration, quotation marks, or speaker labels that are absent from the source.",
    "Preserve HTML and ASS formatting tags such as <i>, <b>, and {\\an8} in equivalent positions.",
    "Keep subtitle lines concise and use no more than two lines per cue.",
  ].join(" ");
}

function cleanJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function validateTranslations(value: unknown, cues: Cue[]) {
  const parsed = value as { translations?: { id: number; text: string }[] };
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== cues.length) {
    throw new Error("The provider returned an incomplete subtitle batch. Try again or choose another provider.");
  }
  const ids = new Set(cues.map((cue) => cue.id));
  if (parsed.translations.some((item) => !ids.has(item.id) || typeof item.text !== "string" || !item.text.trim())) {
    throw new Error("The translated lines did not match the source cue IDs.");
  }
  return parsed.translations;
}

function friendlyFetchError(provider: string, response: Response, detail?: string) {
  if (response.status === 401 || response.status === 403) return new Error(`${provider} did not accept that API key.`);
  if (response.status === 429) return new Error(`${provider} rate limit reached. Wait a moment or choose another provider.`);
  return new Error(detail || `${provider} returned an error (${response.status}).`);
}

async function translateOpenAI(options: TranslateOptions, cues: Cue[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      store: false,
      input: [
        { role: "system", content: systemPrompt(options) },
        { role: "user", content: JSON.stringify({ subtitles: cues.map(({ id, source }) => ({ id, text: source })) }) },
      ],
      text: { format: { type: "json_schema", name: "subtitle_translations", strict: true, schema } },
    }),
  });
  const body = await response.json() as { error?: { message?: string }; output?: { content?: { type?: string; text?: string }[] }[] };
  if (!response.ok) throw friendlyFetchError("OpenAI", response, body.error?.message);
  const text = body.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no translation text.");
  return validateTranslations(JSON.parse(cleanJson(text)), cues);
}

async function translateAnthropic(options: TranslateOptions, cues: Cue[]) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 8_000,
      system: systemPrompt(options),
      messages: [{ role: "user", content: JSON.stringify({ subtitles: cues.map(({ id, source }) => ({ id, text: source })) }) }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });
  const body = await response.json() as { error?: { message?: string }; content?: { type?: string; text?: string }[] };
  if (!response.ok) throw friendlyFetchError("Claude", response, body.error?.message);
  const text = body.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Claude returned no translation text.");
  return validateTranslations(JSON.parse(cleanJson(text)), cues);
}

async function translateGemini(options: TranslateOptions, cues: Cue[]) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": options.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(options) }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ subtitles: cues.map(({ id, source }) => ({ id, text: source })) }) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    }),
  });
  const body = await response.json() as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };
  if (!response.ok) throw friendlyFetchError("Gemini", response, body.error?.message);
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!text) throw new Error("Gemini returned no translation text.");
  return validateTranslations(JSON.parse(cleanJson(text)), cues);
}

async function translateOpenRouter(options: TranslateOptions, cues: Cue[]) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.href,
      "X-Title": "SUB/SHIFT by Nima Moobed",
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: `${systemPrompt(options)} Return only valid JSON matching the supplied schema.` },
        { role: "user", content: JSON.stringify({ subtitles: cues.map(({ id, source }) => ({ id, text: source })), schema }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "subtitle_translations", strict: true, schema } },
    }),
  });
  const body = await response.json() as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  if (!response.ok) throw friendlyFetchError("OpenRouter", response, body.error?.message);
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned no translation text.");
  return validateTranslations(JSON.parse(cleanJson(text)), cues);
}

function decodeEntities(text: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

async function translateGoogle(options: TranslateOptions, cues: Cue[]) {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(options.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: cues.map((cue) => cue.source),
      target: options.targetLanguage,
      ...(options.sourceLanguage !== "auto" ? { source: options.sourceLanguage } : {}),
      format: "text",
    }),
  });
  const body = await response.json() as { error?: { message?: string }; data?: { translations?: { translatedText?: string }[] } };
  if (!response.ok) throw friendlyFetchError("Google Cloud Translation", response, body.error?.message);
  const results = body.data?.translations || [];
  return validateTranslations({ translations: results.map((item, index) => ({ id: cues[index].id, text: decodeEntities(item.translatedText || "") })) }, cues);
}

async function translateLibre(options: TranslateOptions, cues: Cue[]) {
  const endpoint = options.endpoint.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(endpoint)) throw new Error("Enter a valid LibreTranslate server URL.");
  const response = await fetch(`${endpoint}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: cues.map((cue) => cue.source),
      source: options.sourceLanguage,
      target: options.targetLanguage,
      format: "text",
      ...(options.apiKey ? { api_key: options.apiKey } : {}),
    }),
  });
  const body = await response.json() as { error?: string; translatedText?: string | string[] };
  if (!response.ok) throw friendlyFetchError("LibreTranslate", response, body.error);
  const texts = Array.isArray(body.translatedText) ? body.translatedText : [body.translatedText || ""];
  return validateTranslations({ translations: texts.map((text, index) => ({ id: cues[index].id, text })) }, cues);
}

async function detectOnDevice(text: string) {
  const Detector = (globalThis as unknown as { LanguageDetector?: { availability: () => Promise<string>; create: () => Promise<{ detect: (value: string) => Promise<{ detectedLanguage: string }[]>; destroy?: () => void }> } }).LanguageDetector;
  if (!Detector) throw new Error("Automatic language detection is not available in this browser. Choose the source language manually.");
  const detector = await Detector.create();
  const result = await detector.detect(text);
  detector.destroy?.();
  if (!result[0]?.detectedLanguage) throw new Error("The browser could not detect the source language.");
  return result[0].detectedLanguage;
}

async function translateChrome(options: TranslateOptions) {
  const TranslatorApi = (globalThis as unknown as {
    Translator?: {
      availability: (value: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
      create: (value: { sourceLanguage: string; targetLanguage: string; monitor?: (monitor: { addEventListener: (name: string, callback: (event: { loaded: number; total: number }) => void) => void }) => void }) => Promise<{ translate: (text: string) => Promise<string>; destroy?: () => void }>;
    };
  }).Translator;
  if (!TranslatorApi) throw new Error("Chrome on-device translation is not available here. Use desktop Chrome 138+ or choose another provider.");
  const source = options.sourceLanguage === "auto"
    ? await detectOnDevice(options.cues.slice(0, 8).map((cue) => cue.source).join(" "))
    : options.sourceLanguage;
  const availability = await TranslatorApi.availability({ sourceLanguage: source, targetLanguage: options.targetLanguage });
  if (availability === "unavailable") throw new Error("Chrome does not support this language pair on-device. Choose MyMemory or an API provider.");
  const translator = await TranslatorApi.create({ sourceLanguage: source, targetLanguage: options.targetLanguage });
  const translated: { id: number; text: string }[] = [];
  for (const cue of options.cues) {
    translated.push({ id: cue.id, text: await translator.translate(cue.source) });
    options.onProgress(translated.length, options.cues.length);
  }
  translator.destroy?.();
  return translated;
}

async function translateMyMemory(options: TranslateOptions) {
  if (options.sourceLanguage === "auto") throw new Error("MyMemory needs a selected source language. Choose it above and try again.");
  const translated: { id: number; text: string }[] = [];
  for (const cue of options.cues) {
    if (new TextEncoder().encode(cue.source).length > 500) throw new Error(`Cue ${cue.id} exceeds MyMemory's 500-byte segment limit. Choose another provider.`);
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", cue.source);
    url.searchParams.set("langpair", `${options.sourceLanguage}|${options.targetLanguage}`);
    url.searchParams.set("mt", "1");
    const response = await fetch(url);
    const body = await response.json() as { responseStatus?: number; responseDetails?: string; responseData?: { translatedText?: string } };
    if (!response.ok || Number(body.responseStatus || 200) >= 400) throw friendlyFetchError("MyMemory", response, body.responseDetails);
    translated.push({ id: cue.id, text: decodeEntities(body.responseData?.translatedText || "") });
    options.onProgress(translated.length, options.cues.length);
  }
  return translated;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export async function translateCues(options: TranslateOptions) {
  if (options.provider === "chrome") return translateChrome(options);
  if (options.provider === "mymemory") return translateMyMemory(options);
  const result: { id: number; text: string }[] = [];
  const cueChunks = chunks(options.cues, options.provider === "google" || options.provider === "libretranslate" ? 80 : 36);
  for (const cueChunk of cueChunks) {
    let translated: { id: number; text: string }[];
    if (options.provider === "openai") translated = await translateOpenAI(options, cueChunk);
    else if (options.provider === "anthropic") translated = await translateAnthropic(options, cueChunk);
    else if (options.provider === "gemini") translated = await translateGemini(options, cueChunk);
    else if (options.provider === "openrouter") translated = await translateOpenRouter(options, cueChunk);
    else if (options.provider === "google") translated = await translateGoogle(options, cueChunk);
    else translated = await translateLibre(options, cueChunk);
    result.push(...translated);
    options.onProgress(result.length, options.cues.length);
  }
  return result;
}


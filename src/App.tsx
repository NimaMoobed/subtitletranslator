import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { buildSrt, Cue, decodeSubtitle, msToTimestamp, parseSubtitle, subtitleDuration } from "./lib/subtitles";
import { ProviderId, providers, translateCues, TranslationStyle } from "./lib/providers";

const languages = [
  ["auto", "Auto-detect", "تشخیص خودکار"], ["en", "English", "انگلیسی"], ["fa", "Persian", "فارسی"],
  ["ar", "Arabic", "عربی"], ["es", "Spanish", "اسپانیایی"], ["fr", "French", "فرانسوی"],
  ["de", "German", "آلمانی"], ["it", "Italian", "ایتالیایی"], ["pt", "Portuguese", "پرتغالی"],
  ["ru", "Russian", "روسی"], ["uk", "Ukrainian", "اوکراینی"], ["tr", "Turkish", "ترکی"],
  ["ko", "Korean", "کره‌ای"], ["ja", "Japanese", "ژاپنی"], ["zh", "Chinese (Simplified)", "چینی ساده"],
  ["zh-Hant", "Chinese (Traditional)", "چینی سنتی"], ["hi", "Hindi", "هندی"], ["ur", "Urdu", "اردو"],
  ["he", "Hebrew", "عبری"], ["nl", "Dutch", "هلندی"], ["pl", "Polish", "لهستانی"],
  ["sv", "Swedish", "سوئدی"], ["da", "Danish", "دانمارکی"], ["no", "Norwegian", "نروژی"],
  ["fi", "Finnish", "فنلاندی"], ["el", "Greek", "یونانی"], ["cs", "Czech", "چکی"],
  ["ro", "Romanian", "رومانیایی"], ["hu", "Hungarian", "مجاری"], ["id", "Indonesian", "اندونزیایی"],
  ["vi", "Vietnamese", "ویتنامی"], ["th", "Thai", "تایلندی"], ["bn", "Bengali", "بنگالی"],
] as const;

const rtlLanguages = new Set(["fa", "ar", "ur", "he"]);

const copy = {
  en: {
    byline: "A tiny useful thing by Nima Moobed", navAbout: "Why I built this", navGithub: "View source",
    kicker: "ANY LANGUAGE → ANY LANGUAGE", titleA: "Every line.", titleB: "Same perfect timing.",
    intro: "Translate SRT and text-based SUB files without touching a single timestamp. Start free, or bring the translation provider you already use.",
    step1: "Drop the subtitle", step1sub: "SRT or text-based SUB · up to 8 MB", drop: "Drop a subtitle file here", browse: "or browse your computer", local: "Parsed locally. The video never leaves your device.",
    source: "Source language", target: "Target language", swap: "Swap languages", fps: "Video frame rate", step2: "Choose the engine", step2sub: "Free first. More control when you need it.",
    key: "API key", keyHint: "Kept in memory and sent only to the selected provider.", model: "Model", endpoint: "LibreTranslate server", style: "Subtitle style",
    natural: "Natural", cinematic: "Cinematic", literal: "Literal", translate: "Translate subtitles", translating: "Translating", preview: "Preview & export", previewEmpty: "Translated dialogue will appear here.",
    download: "Download translated SRT", freeTruth: "There is no legitimate unlimited public Google Translate API. Free mode uses on-device Chrome or MyMemory's daily allowance; unrestricted LibreTranslate requires your own server.",
    format: "UTF-8 BOM · VLC & PotPlayer ready", privacy: "Your subtitle file stays in your browser. Provider modes send dialogue text—not timestamps—to the provider you choose.",
    made: "Built and marketed by", sourceCode: "Open source on GitHub", demo: "Load demo", change: "Change file", advanced: "Provider settings",
  },
  fa: {
    byline: "یک ابزار کوچک و کاربردی از نیما موبد", navAbout: "چرا ساختمش", navGithub: "مشاهده کد",
    kicker: "هر زبان ← هر زبان", titleA: "هر دیالوگ.", titleB: "همان زمان‌بندی دقیق.",
    intro: "فایل‌های SRT و SUB متنی را بدون تغییر حتی یک تایم‌کد ترجمه کنید. رایگان شروع کنید یا سرویس ترجمه دلخواه خودتان را وصل کنید.",
    step1: "فایل زیرنویس", step1sub: "SRT یا SUB متنی · حداکثر ۸ مگابایت", drop: "فایل زیرنویس را اینجا رها کنید", browse: "یا از کامپیوتر انتخاب کنید", local: "فایل در مرورگر شما خوانده می‌شود و ویدیو جایی ارسال نمی‌شود.",
    source: "زبان مبدأ", target: "زبان مقصد", swap: "جابه‌جایی زبان‌ها", fps: "نرخ فریم ویدیو", step2: "موتور ترجمه", step2sub: "اول رایگان؛ هر وقت خواستید کنترل بیشتر.",
    key: "کلید API", keyHint: "ذخیره نمی‌شود و فقط برای درخواست ترجمه به سرویس انتخابی ارسال می‌شود.", model: "مدل", endpoint: "سرور LibreTranslate", style: "سبک زیرنویس",
    natural: "روان", cinematic: "سینمایی", literal: "تحت‌اللفظی", translate: "ترجمه زیرنویس", translating: "در حال ترجمه", preview: "پیش‌نمایش و خروجی", previewEmpty: "ترجمه دیالوگ‌ها اینجا نمایش داده می‌شود.",
    download: "دانلود SRT ترجمه‌شده", freeTruth: "API عمومی و نامحدود و قانونی برای Google Translate وجود ندارد. حالت رایگان از ترجمه داخلی Chrome یا سهمیه روزانه MyMemory استفاده می‌کند؛ LibreTranslate نامحدود به سرور شخصی نیاز دارد.",
    format: "UTF-8 BOM · آماده برای VLC و PotPlayer", privacy: "فایل زیرنویس در مرورگر شما می‌ماند. در حالت سرویس‌دهنده فقط متن دیالوگ، نه تایم‌کدها، برای سرویس انتخابی ارسال می‌شود.",
    made: "ساخته و معرفی‌شده توسط", sourceCode: "متن‌باز در گیت‌هاب", demo: "نمایش نمونه", change: "تغییر فایل", advanced: "تنظیمات سرویس",
  },
} as const;

const sample = `1\n00:00:04,200 --> 00:00:07,100\nI didn't think you'd come back.\n\n2\n00:00:08,000 --> 00:00:11,000\nSome promises are hard to forget.`;

function languageName(code: string, locale: "en" | "fa") {
  const match = languages.find((item) => item[0] === code);
  return match ? match[locale === "en" ? 1 : 2] : code;
}

function event(name: string, params: Record<string, string | number> = {}) {
  window.gtag?.("event", name, params);
}

export default function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [locale, setLocale] = useState<"en" | "fa">("en");
  const [fileName, setFileName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [encoding, setEncoding] = useState("");
  const [extension, setExtension] = useState(".srt");
  const [format, setFormat] = useState("srt");
  const [fps, setFps] = useState(23.976);
  const [cues, setCues] = useState<Cue[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("fa");
  const [provider, setProvider] = useState<ProviderId>("mymemory");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(providers.mymemory.defaultModel);
  const [endpoint, setEndpoint] = useState("http://localhost:5000");
  const [style, setStyle] = useState<TranslationStyle>("natural");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const t = copy[locale];
  const translatedCount = cues.filter((cue) => cue.translated).length;
  const isMicroDvd = format === "microdvd";
  const targetDir = rtlLanguages.has(targetLanguage) ? "rtl" : "ltr";

  const parsedCues = useMemo(() => {
    if (!sourceText) return cues;
    try { return parseSubtitle(sourceText, extension, fps).cues; } catch { return cues; }
  }, [sourceText, extension, fps, cues]);

  async function loadFile(file: File) {
    setMessage("");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".srt", ".sub"].includes(ext)) return setMessage("Please choose an .srt or text-based .sub file.");
    if (file.size > 8 * 1024 * 1024) return setMessage("The subtitle file must be smaller than 8 MB.");
    try {
      const decoded = decodeSubtitle(await file.arrayBuffer());
      const parsed = parseSubtitle(decoded.text, ext, fps);
      setFileName(file.name); setExtension(ext); setEncoding(decoded.encoding); setSourceText(decoded.text);
      setFormat(parsed.format); setCues(parsed.cues); setProgress(0);
      event("subtitle_file_loaded", { format: parsed.format, cue_count: parsed.cues.length });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read that file."); }
  }

  function onFile(eventValue: ChangeEvent<HTMLInputElement>) {
    const file = eventValue.target.files?.[0];
    if (file) void loadFile(file);
    eventValue.target.value = "";
  }

  function onDrop(eventValue: DragEvent<HTMLDivElement>) {
    eventValue.preventDefault(); setDragging(false);
    const file = eventValue.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  function loadDemo() {
    const parsed = parseSubtitle(sample, ".srt", fps);
    setFileName("movie-night.srt"); setExtension(".srt"); setEncoding("UTF-8"); setSourceText(sample); setFormat("srt"); setCues(parsed.cues); setMessage("");
  }

  function selectProvider(next: ProviderId) {
    setProvider(next); setModel(providers[next].defaultModel); setMessage("");
  }

  function swapLanguages() {
    if (sourceLanguage === "auto") return;
    setSourceLanguage(targetLanguage); setTargetLanguage(sourceLanguage);
  }

  async function translate() {
    if (!parsedCues.length) return;
    if (providers[provider].needsKey && !apiKey.trim()) return setMessage("Enter the API key for the selected provider.");
    if (sourceLanguage === targetLanguage) return setMessage("Source and target languages must be different.");
    setBusy(true); setMessage(""); setProgress(0);
    const working = parsedCues.map((cue) => ({ ...cue, translated: undefined }));
    setCues(working);
    event("subtitle_translation_started", { provider, source_language: sourceLanguage, target_language: targetLanguage, cue_count: working.length });
    try {
      const results = await translateCues({
        provider, apiKey: apiKey.trim(), model: model.trim(), endpoint: endpoint.trim(),
        sourceLanguage, sourceName: languageName(sourceLanguage, "en"),
        targetLanguage, targetName: languageName(targetLanguage, "en"), style, cues: working,
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      });
      const map = new Map(results.map((item) => [item.id, item.text]));
      setCues(working.map((cue) => ({ ...cue, translated: map.get(cue.id) })));
      setProgress(100);
      event("subtitle_translation_completed", { provider, cue_count: working.length, target_language: targetLanguage });
    } catch (error) {
      setMessage(error instanceof TypeError ? "The browser blocked this provider request. Try Gemini, Chrome on-device, MyMemory, or a CORS-enabled LibreTranslate server." : error instanceof Error ? error.message : "Translation failed.");
      event("subtitle_translation_error", { provider });
    } finally { setBusy(false); }
  }

  function download() {
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), buildSrt(cues)], { type: "application/x-subrip;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${fileName.replace(/\.(srt|sub)$/i, "")}.${targetLanguage}.srt`; anchor.click(); URL.revokeObjectURL(url);
    event("subtitle_downloaded", { provider, target_language: targetLanguage, cue_count: cues.length });
  }

  return (
    <div className="app-shell" dir={locale === "fa" ? "rtl" : "ltr"}>
      <header className="site-header">
        <a className="wordmark" href="#top"><span>SUB</span><i>/</i><span>SHIFT</span></a>
        <nav>
          <a href="https://nmoobed.com/?utm_source=subtitletranslator&utm_medium=product&utm_campaign=subshift" target="_blank" rel="noreferrer">{t.byline}</a>
          <a href="https://github.com/NimaMoobed/subtitletranslator?utm_source=subtitletranslator&utm_medium=product" target="_blank" rel="noreferrer">{t.navGithub} ↗</a>
          <button className="locale-toggle" onClick={() => setLocale(locale === "en" ? "fa" : "en")}>{locale === "en" ? "فا" : "EN"}</button>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true"><span>00:14:08,210</span><span>→</span><span>00:14:11,760</span></div>
          <p className="kicker"><span /> {t.kicker}</p>
          <h1>{t.titleA}<br /><em>{t.titleB}</em></h1>
          <p className="intro">{t.intro}</p>
          <div className="language-rail">
            <label>{t.source}<select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>{languages.map((lang) => <option key={lang[0]} value={lang[0]}>{lang[locale === "en" ? 1 : 2]}</option>)}</select></label>
            <button className="swap-button" onClick={swapLanguages} title={t.swap} aria-label={t.swap}>⇄</button>
            <label>{t.target}<select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>{languages.filter((lang) => lang[0] !== "auto").map((lang) => <option key={lang[0]} value={lang[0]}>{lang[locale === "en" ? 1 : 2]}</option>)}</select></label>
          </div>
        </section>

        <section className="translator-card">
          <div className="upload-panel">
            <div className="section-number">01</div><div className="section-title"><h2>{t.step1}</h2><p>{t.step1sub}</p></div>
            <div className={`dropzone ${dragging ? "dragging" : ""} ${fileName ? "loaded" : ""}`} onClick={() => fileInput.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInput.current?.click(); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} role="button" tabIndex={0}>
              <input ref={fileInput} type="file" accept=".srt,.sub" onChange={onFile} />
              {fileName ? <><div className="file-badge">{extension.slice(1).toUpperCase()}</div><div className="file-copy"><strong>{fileName}</strong><span>{parsedCues.length} cues · {msToTimestamp(subtitleDuration(parsedCues)).slice(0, 8)} · {encoding}</span></div><u>{t.change}</u></> : <><div className="drop-icon">↓</div><strong>{t.drop}</strong><span>{t.browse}</span><small>{t.local}</small></>}
            </div>
            {!fileName && <button className="demo-link" onClick={loadDemo}>{t.demo} →</button>}
            {isMicroDvd && <label className="fps-input">{t.fps}<input type="number" value={fps} min="1" max="120" step="0.001" onChange={(e) => setFps(Number(e.target.value) || 23.976)} /></label>}
          </div>

          <div className="engine-panel">
            <div className="section-number">02</div><div className="section-title"><h2>{t.step2}</h2><p>{t.step2sub}</p></div>
            <div className="provider-grid">
              {(Object.keys(providers) as ProviderId[]).map((id) => <button key={id} className={provider === id ? "active" : ""} onClick={() => selectProvider(id)}><span className="provider-radio" /><strong>{providers[id].name}</strong><small>{providers[id].badge}</small></button>)}
            </div>
            <p className="provider-description">{providers[provider].description}</p>
            {(providers[provider].needsKey || provider === "libretranslate") && <details open className="provider-settings"><summary>{t.advanced}</summary>
              {provider === "libretranslate" && <label>{t.endpoint}<input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://translate.example.com" /></label>}
              {(providers[provider].needsKey || provider === "libretranslate") && <label>{t.key}<div className="secret-input"><input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === "libretranslate" ? "Optional" : "Required"} autoComplete="off" /><button onClick={() => setShowKey(!showKey)}>{showKey ? "Hide" : "Show"}</button></div><small>{t.keyHint}</small></label>}
              {providers[provider].defaultModel && <label>{t.model}<input value={model} onChange={(e) => setModel(e.target.value)} /></label>}
            </details>}
            <div className="style-row"><span>{t.style}</span>{(["natural", "cinematic", "literal"] as TranslationStyle[]).map((id) => <button key={id} className={style === id ? "active" : ""} onClick={() => setStyle(id)}>{t[id]}</button>)}</div>
            <button className="translate-button" disabled={!parsedCues.length || busy} onClick={translate}><span>{busy ? `${t.translating}… ${progress}%` : t.translate}</span><b>→</b></button>
            {busy && <div className="progress"><span style={{ width: `${progress}%` }} /></div>}
            {message && <div className="message" role="alert">{message}</div>}
          </div>
        </section>

        <section className={`preview ${translatedCount ? "has-results" : ""}`}>
          <div className="preview-header"><div><span>03</span><h2>{t.preview}</h2><p>{translatedCount ? `${translatedCount}/${cues.length} · ${t.format}` : t.previewEmpty}</p></div>{translatedCount > 0 && <button onClick={download}>{t.download} ↓</button>}</div>
          {translatedCount > 0 ? <div className="cue-table"><div className="cue-labels"><span>TIME</span><span>{languageName(sourceLanguage, locale)}</span><span>{languageName(targetLanguage, locale)}</span></div>{cues.slice(0, 6).map((cue) => <div className="cue" key={cue.id}><time>{msToTimestamp(cue.startMs).slice(3, 8)}<small>→ {msToTimestamp(cue.endMs).slice(3, 8)}</small></time><p>{cue.source}</p><p dir={targetDir} lang={targetLanguage}>{cue.translated}</p></div>)}{cues.length > 6 && <div className="more">+{cues.length - 6} more cues in the download</div>}</div> : <div className="preview-empty"><span>CC</span><div className="pulse-line" /><div className="pulse-line short" /></div>}
        </section>

        <section className="truth-strip"><div><b>01</b><p>{t.freeTruth}</p></div><div><b>02</b><p>{t.privacy}</p></div><div><b>03</b><p>{t.format}</p></div></section>
      </main>

      <footer><a href="https://nmoobed.com/?utm_source=subtitletranslator&utm_medium=footer&utm_campaign=subshift" target="_blank" rel="noreferrer">{t.made} <strong>Nima Moobed</strong> ↗</a><a href="https://github.com/NimaMoobed/subtitletranslator" target="_blank" rel="noreferrer">{t.sourceCode} ↗</a><span>SUB/SHIFT © 2026</span></footer>
    </div>
  );
}


export type Cue = {
  id: number;
  startMs: number;
  endMs: number;
  source: string;
  translated?: string;
};

export type ParsedSubtitle = {
  cues: Cue[];
  encoding: string;
  format: "srt" | "microdvd" | "subviewer";
};

export function decodeSubtitle(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "UTF-8 BOM" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "UTF-16 LE" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = bytes.slice(2);
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    }
    return { text: new TextDecoder("utf-16le").decode(swapped), encoding: "UTF-16 BE" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "Windows-1252" };
  }
}

function timestampToMs(value: string) {
  const match = value.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{2,3})/);
  if (!match) throw new Error(`Invalid timestamp: ${value}`);
  const fraction = match[4].length === 2 ? Number(match[4]) * 10 : Number(match[4].padEnd(3, "0").slice(0, 3));
  return Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000 + Number(match[3]) * 1_000 + fraction;
}

export function msToTimestamp(ms: number) {
  const safe = Math.max(0, Math.round(ms));
  const h = Math.floor(safe / 3_600_000);
  const m = Math.floor((safe % 3_600_000) / 60_000);
  const s = Math.floor((safe % 60_000) / 1_000);
  const milli = safe % 1_000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
}

function parseSrt(input: string): Cue[] {
  const cues: Cue[] = [];
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [start, end] = lines[timingIndex].split(/\s*-->\s*/);
    const source = lines.slice(timingIndex + 1).join("\n").trim();
    if (!start || !end || !source) continue;
    cues.push({ id: cues.length + 1, startMs: timestampToMs(start), endMs: timestampToMs(end), source });
  }
  return cues;
}

function parseMicroDvd(input: string, fps: number): Cue[] {
  const cues: Cue[] = [];
  for (const line of input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(/^\{(\d+)\}\{(\d+)\}([\s\S]*)$/);
    if (!match || !match[3].trim()) continue;
    cues.push({
      id: cues.length + 1,
      startMs: (Number(match[1]) / fps) * 1_000,
      endMs: (Number(match[2]) / fps) * 1_000,
      source: match[3].replace(/^\{[yY]:[biu]+\}/, "").replace(/\|/g, "\n"),
    });
  }
  return cues;
}

function parseSubViewer(input: string): Cue[] {
  const lines = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const cues: Cue[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})\s*,\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})$/);
    if (!match) continue;
    const text: string[] = [];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^\[/.test(lines[i])) {
      text.push(lines[i].replace(/\[br\]/gi, "\n"));
      i += 1;
    }
    if (text.join("").trim()) {
      cues.push({ id: cues.length + 1, startMs: timestampToMs(match[1]), endMs: timestampToMs(match[2]), source: text.join("\n") });
    }
  }
  return cues;
}

export function parseSubtitle(input: string, extension: string, fps: number): Omit<ParsedSubtitle, "encoding"> {
  if (/^\s*\{\d+\}\{\d+\}/m.test(input)) {
    const cues = parseMicroDvd(input, fps);
    if (!cues.length) throw new Error("No readable MicroDVD cues were found.");
    return { cues, format: "microdvd" };
  }
  if (/^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}\s*,\s*\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}/m.test(input) && !input.includes("-->")) {
    const cues = parseSubViewer(input);
    if (!cues.length) throw new Error("No readable SubViewer cues were found.");
    return { cues, format: "subviewer" };
  }
  const cues = parseSrt(input);
  if (!cues.length && extension === ".sub") {
    throw new Error("This looks like a binary VobSub file. Use a text-based .sub or convert it to .srt first.");
  }
  if (!cues.length) throw new Error("No readable subtitle cues were found.");
  return { cues, format: "srt" };
}

export function buildSrt(cues: Cue[]) {
  return cues.map((cue, index) => [
    index + 1,
    `${msToTimestamp(cue.startMs)} --> ${msToTimestamp(cue.endMs)}`,
    cue.translated || cue.source,
  ].join("\r\n")).join("\r\n\r\n") + "\r\n";
}

export function subtitleDuration(cues: Cue[]) {
  return cues.length ? cues[cues.length - 1].endMs : 0;
}


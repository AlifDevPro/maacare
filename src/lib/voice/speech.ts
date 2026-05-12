export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function createRecognition(opts: {
  lang: string;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = opts.lang;
  rec.maxAlternatives = 1;

  rec.onresult = (ev: unknown) => {
    // Web Speech API event typing varies across browsers. Use permissive parsing.
    const e = ev as {
      results?: ArrayLike<ArrayLike<{ transcript: string; confidence?: number } & { isFinal?: boolean }>> & {
        [k: number]: ArrayLike<{ transcript: string }>;
      };
      resultIndex?: number;
    };

    const results = e.results;
    if (!results) return;

    let interim = "";
    let final = "";

    for (let i = e.resultIndex ?? 0; i < results.length; i += 1) {
      const r = results[i] as unknown as {
        isFinal?: boolean;
        0?: { transcript?: string };
        [k: number]: { transcript?: string } | undefined;
      };
      const t = (r?.[0]?.transcript ?? "").toString();
      if (!t) continue;
      if (r.isFinal) final += t;
      else interim += t;
    }

    if (interim.trim()) opts.onPartial(interim.trim());
    if (final.trim()) opts.onFinal(final.trim());
  };

  rec.onerror = (ev: unknown) => {
    const e = ev as { error?: string; message?: string };
    const msg = e.message ?? e.error ?? "Speech recognition error";
    opts.onError(msg);
  };

  rec.onend = () => {
    opts.onEnd?.();
  };

  return rec;
}

export function speakText(opts: {
  text: string;
  lang: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    const u = new SpeechSynthesisUtterance(opts.text);
    u.lang = opts.lang;
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = opts.volume ?? 1;
    u.onend = () => resolve();
    u.onerror = () => reject(new Error("TTS failed"));

    synth.cancel(); // stop any previous speech to feel like a phone call
    synth.speak(u);
  });
}

/** Strip markdown / formatting so Web Speech reads naturally. */
export function stripTextForSpeech(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`+/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/#{1,6}\s+/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

function splitIntoSpeechChunks(text: string, maxLen = 240): string[] {
  const cleaned = stripTextForSpeech(text);
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?।॥])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flushBuf = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };

  for (const seg of sentences) {
    const next = buf ? `${buf} ${seg}` : seg;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      flushBuf();
      if (seg.length <= maxLen) {
        buf = seg;
      } else {
        for (let i = 0; i < seg.length; i += maxLen) {
          chunks.push(seg.slice(i, i + maxLen).trim());
        }
      }
    }
  }
  flushBuf();
  return chunks;
}

/**
 * Speak with short pauses between phrases/sentences so browser TTS feels less robotic.
 * Cancels any in-flight speech once at the start (same as speakText).
 */
export function speakNatural(opts: {
  text: string;
  lang: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Pause between chunks (ms). */
  pauseBetweenMs?: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    const parts = splitIntoSpeechChunks(opts.text);
    if (parts.length === 0) return resolve();

    synth.cancel();

    const pause = opts.pauseBetweenMs ?? 140;
    const rate = opts.rate ?? 0.96;
    const pitch = opts.pitch ?? 1;
    const volume = opts.volume ?? 1;

    let idx = 0;
    const speakNext = () => {
      if (idx >= parts.length) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[idx]);
      u.lang = opts.lang;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      u.onerror = () => reject(new Error("TTS failed"));
      u.onend = () => {
        idx += 1;
        window.setTimeout(speakNext, pause);
      };
      synth.speak(u);
    };

    speakNext();
  });
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}


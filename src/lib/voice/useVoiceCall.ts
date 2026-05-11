import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRecognition, isSpeechRecognitionSupported, stopSpeaking } from "./speech";

export type VoiceCallState = "idle" | "listening" | "thinking" | "speaking" | "error";

export function useVoiceCall(opts: {
  lang: string;
  enabled: boolean;
  muted: boolean;
  autoRestart: boolean;
  onTurn: (finalText: string) => Promise<string | null>; // returns assistant reply (for TTS), or null
  onSpeak: (assistantText: string) => Promise<void>;
  onUnsupported: () => void;
}) {
  const [state, setState] = useState<VoiceCallState>("idle");
  const [partial, setPartial] = useState<string>("");
  const [lastError, setLastError] = useState<string | null>(null);

  const supported = useMemo(() => isSpeechRecognitionSupported(), []);
  const recRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const activeRef = useRef(false);
  const finalBufferRef = useRef<string>("");
  const silenceTimerRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const startLockRef = useRef(false);
  const lastStartAtRef = useRef(0);

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    startLockRef.current = false;
    setPartial("");
    finalBufferRef.current = "";
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setState("idle");
  }, []);

  const scheduleFinalize = useCallback(
    (text: string) => {
      finalBufferRef.current = text;
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        const t = finalBufferRef.current.trim();
        finalBufferRef.current = "";
        if (!t) return;
        void (async () => {
          processingRef.current = true;
          setPartial("");
          setState("thinking");
          try {
            const reply = await opts.onTurn(t);
            if (!reply || opts.muted) {
              setState("idle");
              processingRef.current = false;
              if (opts.autoRestart && activeRef.current) {
                try {
                  recRef.current?.start();
                  setState("listening");
                } catch {
                  // ignore
                }
              }
              return;
            }
            setState("speaking");
            await opts.onSpeak(reply);
            setState("idle");
            processingRef.current = false;
            if (opts.autoRestart && activeRef.current) {
              try {
                recRef.current?.start();
                setState("listening");
              } catch {
                // ignore
              }
            }
          } catch (e) {
            processingRef.current = false;
            setLastError(e instanceof Error ? e.message : "Voice turn failed");
            setState("error");
          }
        })();
      }, 650);
    },
    [opts],
  );

  const restartListeningSoon = useCallback(
    (delayMs = 220) => {
      if (!opts.autoRestart || !activeRef.current || processingRef.current) return;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        if (!activeRef.current || processingRef.current || startLockRef.current) return;
        try {
          startLockRef.current = true;
          lastStartAtRef.current = Date.now();
          recRef.current?.start();
          setState("listening");
        } catch {
          // If restart fails repeatedly, settle into idle to avoid visual jitter.
          setState("idle");
          activeRef.current = false;
        } finally {
          startLockRef.current = false;
        }
      }, delayMs);
    },
    [opts.autoRestart],
  );

  const start = useCallback(() => {
    if (!opts.enabled) return;
    if (!supported) {
      opts.onUnsupported();
      return;
    }
    if (startLockRef.current) return;
    const now = Date.now();
    if (now - lastStartAtRef.current < 180) return;

    stopSpeaking();
    setLastError(null);
    setPartial("");

    if (!recRef.current) {
      recRef.current = createRecognition({
        lang: opts.lang,
        onPartial: (t) => {
          if (!activeRef.current) return;
          setPartial(t);
        },
        onFinal: (t) => {
          if (!activeRef.current) return;
          const final = t.trim();
          if (!final) return;
          scheduleFinalize(final);
        },
        onError: (msg) => {
          const normalized = msg.toLowerCase();
          const isBenign =
            normalized.includes("no-speech") ||
            normalized.includes("aborted") ||
            normalized.includes("network");
          const isFatal =
            normalized.includes("not-allowed") ||
            normalized.includes("permission") ||
            normalized.includes("service-not-allowed") ||
            normalized.includes("audio-capture") ||
            normalized.includes("not-found");

          if (isFatal) {
            setLastError(msg);
            setState("error");
            activeRef.current = false;
            return;
          }

          if (isBenign) {
            setPartial("");
            setState("idle");
            restartListeningSoon(350);
            return;
          }

          setLastError(msg);
          setState("error");
          activeRef.current = false;
        },
        onEnd: () => {
          setPartial("");
          if (activeRef.current && !processingRef.current) {
            setState("idle");
            restartListeningSoon(220);
            return;
          }
          setState((s) => (s === "thinking" || s === "speaking" ? s : "idle"));
        },
      });
    }

    activeRef.current = true;
    setState("listening");
    try {
      startLockRef.current = true;
      lastStartAtRef.current = Date.now();
      recRef.current?.start();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Could not start microphone");
      setState("error");
      activeRef.current = false;
    } finally {
      startLockRef.current = false;
    }
  }, [opts.enabled, opts.lang, opts, scheduleFinalize, supported, restartListeningSoon]);

  useEffect(() => {
    if (!opts.enabled) {
      stop();
      stopSpeaking();
    }
  }, [opts.enabled, stop]);

  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
      stopSpeaking();
    };
  }, []);

  return {
    supported,
    state,
    partial,
    lastError,
    start,
    stop,
  };
}


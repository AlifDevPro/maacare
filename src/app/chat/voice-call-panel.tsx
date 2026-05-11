"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoiceCallState } from "@/lib/voice/useVoiceCall";

export function VoiceCallPanel({
  state,
  partial,
  muted,
  micMuted,
  onToggleMuted,
  onToggleMicMuted,
  onStartCall,
  onEnd,
  showTranscript,
  onToggleTranscript,
  disabled,
}: {
  state: VoiceCallState;
  partial: string;
  muted: boolean;
  micMuted: boolean;
  onToggleMuted: () => void;
  onToggleMicMuted: () => void;
  onStartCall: () => void;
  onEnd: () => void;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  disabled?: boolean;
}) {
  const listening = state === "listening";
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const connected = state !== "idle";

  const status = thinking ? "Thinking" : speaking ? "Speaking" : listening ? "Listening" : connected ? "Connected" : "Ready";

  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const mm = useMemo(() => String(Math.floor(seconds / 60)).padStart(2, "0"), [seconds]);
  const ss = useMemo(() => String(seconds % 60).padStart(2, "0"), [seconds]);

  return (
    <div className="fixed inset-x-0 top-14 z-50 mx-auto flex h-[calc(100dvh-3.5rem-5rem-env(safe-area-inset-bottom))] max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MaaCare Voice</p>
          <p className="text-sm font-medium text-foreground/90">{status}</p>
        </div>
        <p className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-muted-foreground shadow-soft">
          {mm}:{ss}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative">
          {/* Outer speaking rings */}
          {speaking ? (
            <>
              <motion.div
                className="absolute inset-0 -z-10 rounded-full border border-primary/30"
                initial={{ opacity: 0.0, scale: 1 }}
                animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.35, 1.05] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 180, height: 180, left: -30, top: -30 }}
              />
              <motion.div
                className="absolute inset-0 -z-10 rounded-full border border-accent/25"
                initial={{ opacity: 0.0, scale: 1 }}
                animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.55, 1.1] }}
                transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 220, height: 220, left: -50, top: -50 }}
              />
            </>
          ) : null}

          {/* Main orb */}
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (micMuted) onToggleMicMuted();
              else onToggleMicMuted();
            }}
            className={cn(
              "relative flex h-32 w-32 items-center justify-center rounded-full shadow-card transition-colors",
              thinking
                ? "bg-muted text-muted-foreground"
                : speaking
                  ? "bg-gradient-hero text-primary"
                  : listening
                    ? "bg-primary-soft text-primary"
                    : "bg-card text-foreground",
              disabled && "opacity-60",
            )}
            initial={false}
            animate={{
              scale: listening ? [1, 1.03, 1] : speaking ? [1, 1.06, 1] : 1,
            }}
            transition={{ duration: 1.05, repeat: listening || speaking ? Infinity : 0, ease: "easeInOut" }}
            aria-label={micMuted ? "Microphone muted" : "Microphone active"}
          >
            <span className="absolute inset-0 rounded-full bg-gradient-rose opacity-20 blur-2xl" />
            {thinking ? (
              <Loader2 className="relative h-10 w-10 animate-spin" />
            ) : micMuted ? (
              <MicOff className="relative h-12 w-12" />
            ) : (
              <Mic className="relative h-12 w-12" />
            )}
          </motion.button>
        </div>

        {/* Listening dots */}
        {listening ? (
          <div className="mt-6 flex items-center gap-2">
            <Dot delay={0} />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </div>
        ) : null}

        {/* Partial transcript (subtle) */}
        {partial && showTranscript ? (
          <div className="mt-6 w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm text-foreground shadow-soft">
            <p className="break-words">{partial}</p>
          </div>
        ) : null}
      </div>

      <div className="pb-2">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={onToggleTranscript}
            disabled={disabled}
          >
            <MessagesSquare className="mr-2 h-4 w-4" />
            {showTranscript ? "Hide text" : "Show text"}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <CircleButton
            label={micMuted ? "Mic off" : "Mic on"}
            onClick={onToggleMicMuted}
            disabled={disabled}
          >
            {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </CircleButton>
          <CircleButton
            label={muted ? "Sound off" : "Sound on"}
            onClick={onToggleMuted}
            disabled={disabled}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </CircleButton>
          <CircleButton label="End" onClick={onEnd} variant="destructive">
            <PhoneOff className="h-5 w-5" />
          </CircleButton>
        </div>
      </div>

      {/* Start call (kick recognition) */}
      <button type="button" className="sr-only" onClick={onStartCall} aria-hidden />
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-2 w-2 rounded-full bg-primary"
      initial={false}
      animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

function CircleButton({
  children,
  label,
  onClick,
  variant,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={variant === "destructive" ? "destructive" : "secondary"}
      size="icon"
      className="h-12 w-12 rounded-full shadow-soft"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}


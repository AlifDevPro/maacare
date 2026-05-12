"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MessageCircle, MessagesSquare, Phone, Users, Mail, LifeBuoy, BookOpen, Ticket } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSession } from "@/lib/auth-client";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

function SupportTicketCard() {
  const { user } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to submit a ticket.");
      return;
    }
    const sub = subject.trim();
    const msg = message.trim();
    if (!sub || !msg) {
      toast.error("Add a subject and a short message.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "support_ticket",
          message: msg,
          context: { subject: sub },
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string; issues?: { path: string[] }[] };
      if (!res.ok) {
        throw new Error(j.message ?? "Could not send ticket");
      }
      toast.success("Ticket sent. We will follow up when we can.");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Ticket className="h-4 w-4 text-primary" />
          Support ticket
        </CardTitle>
        <CardDescription>
          For account access, something broken in the app, or billing — not for medical emergencies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user ? (
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject" className="text-xs font-medium">
                Subject
              </Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="Short summary"
                className="rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-message" className="text-xs font-medium">
                Message
              </Label>
              <Textarea
                id="ticket-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={8000}
                placeholder="What happened, what you expected, and any steps to reproduce."
                className="rounded-xl resize-y min-h-[100px]"
              />
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
              {submitting ? "Sending…" : "Submit ticket"}
            </Button>
          </form>
        ) : (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Sign in to open a ticket.{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Log in
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HelpPage() {
  const mailHref = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : null;

  return (
    <AppShell>
      <AppHeader title="Help & support" showBack backHref="/app" />
      <div className="space-y-4 px-4 pt-4 pb-8">
        <Card className="rounded-2xl border-amber-300/40 bg-amber-50/90 shadow-none dark:border-amber-500/35 dark:bg-amber-500/10">
          <CardContent className="flex gap-3 pt-4 text-sm text-amber-950 dark:text-amber-100">
            <Phone className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-semibold">Not for emergencies.</strong> If you or someone else is in danger,
              call your local emergency number right away.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button variant="outline" className="h-auto min-h-24 flex-col gap-1 rounded-2xl py-4" asChild>
            <Link href="/chat">
              <MessagesSquare className="h-6 w-6 text-primary" />
              <span className="font-display text-sm font-semibold">AI chat</span>
              <span className="text-xs text-muted-foreground">Guidance & questions</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto min-h-24 flex-col gap-1 rounded-2xl py-4" asChild>
            <Link href="/community">
              <Users className="h-6 w-6 text-primary" />
              <span className="font-display text-sm font-semibold">Community</span>
              <span className="text-xs text-muted-foreground">Connect with others</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto min-h-24 flex-col gap-1 rounded-2xl py-4" asChild>
            <Link href="/docs">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="font-display text-sm font-semibold">Documentation</span>
              <span className="text-xs text-muted-foreground">Features, APIs & guides</span>
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Contact us
            </CardTitle>
            <CardDescription>We read every message when we can.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mailHref ? (
              <Button className="h-11 w-full rounded-xl" asChild>
                <a href={mailHref}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email support
                </a>
              </Button>
            ) : (
              <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Support email is not configured yet. Use the AI chat for product questions, or speak with your
                clinician for medical decisions.
              </p>
            )}
            {SUPPORT_EMAIL ? (
              <p className="text-center text-xs text-muted-foreground">
                <span className="select-all font-mono text-foreground/80">{SUPPORT_EMAIL}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <SupportTicketCard />

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Common questions</CardTitle>
            <CardDescription>Quick answers about MaaCare.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="medical">
                <AccordionTrigger className="text-left text-sm font-medium">
                  Is MaaCare medical advice?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  No. MaaCare gives educational information and tools to support your journey. It does not diagnose
                  conditions or replace your doctor or midwife.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="data">
                <AccordionTrigger className="text-left text-sm font-medium">
                  Where is my data stored?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Your account is secured with industry-standard sign-in. Profile details you enter are stored so the
                  app can show reminders and community features. You can export a copy from your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="password">
                <AccordionTrigger className="text-left text-sm font-medium">
                  How do I change my password?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Open <Link href="/settings" className="font-medium text-primary underline-offset-2 hover:underline">Settings</Link>{" "}
                  and choose <strong className="text-foreground/90">Change password</strong>, or use the link on the log
                  in screen if you are signed out.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="community">
                <AccordionTrigger className="text-left text-sm font-medium">
                  What are community posts for?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Community is for peer support and sharing experiences. Moderators may hide content that breaks our
                  safety guidelines. It is not a place for urgent clinical decisions.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="voice">
                <AccordionTrigger className="text-left text-sm font-medium">
                  Voice chat in AI assistant?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Voice works in supported browsers. If it is unavailable, use text chat — you get the same safety
                  framing either way.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" asChild>
          <Link href="/app">
            <MessageCircle className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

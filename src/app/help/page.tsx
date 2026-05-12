"use client";

import Link from "next/link";
import { MessageCircle, MessagesSquare, Phone, Users, Mail, LifeBuoy } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

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

        <div className="grid gap-3 sm:grid-cols-2">
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

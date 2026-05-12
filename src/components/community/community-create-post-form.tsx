"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CommunityRichEditor } from "@/components/community/community-rich-editor";
import { isRichPostBodyEmpty } from "@/lib/community/rich-post-empty";
import { useSession } from "@/lib/auth-client";

const FORM_ID = "community-create-post";

export function CommunityCreatePostForm() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [postKind, setPostKind] = useState<"post" | "question" | "tip">("post");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent("/community/create")}`);
    }
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    const bodyVal = body.trim();
    if (isRichPostBodyEmpty(bodyVal)) {
      toast.error("Write something for your post.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          body: bodyVal,
          postKind,
          bodyFormat: "html",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not publish");
      router.push("/community");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell hideNav>
        <AppHeader title="Create post" showBack backHref="/community" />
        <div className="flex flex-1 items-center justify-center px-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell hideNav>
        <AppHeader title="Create post" showBack backHref="/community" />
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Redirecting to sign in…</div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <AppHeader title="Create post" showBack backHref="/community" />
      <form id={FORM_ID} className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-32">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Post type</Label>
            <ToggleGroup
              type="single"
              value={postKind}
              onValueChange={(v) => {
                if (v === "post" || v === "question" || v === "tip") setPostKind(v);
              }}
              className="grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-border/70 bg-muted/25 p-1"
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem
                value="post"
                className="h-11 flex-col gap-0 rounded-xl px-1 py-1.5 text-xs font-semibold data-[state=on]:border-primary/40 data-[state=on]:bg-background data-[state=on]:shadow-sm sm:text-sm"
              >
                Post
                <span className="text-[10px] font-normal text-muted-foreground">Share</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="question"
                className="h-11 flex-col gap-0 rounded-xl px-1 py-1.5 text-xs font-semibold data-[state=on]:border-primary/40 data-[state=on]:bg-background data-[state=on]:shadow-sm sm:text-sm"
              >
                Question
                <span className="text-[10px] font-normal text-muted-foreground">Ask</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="tip"
                className="h-11 flex-col gap-0 rounded-xl px-1 py-1.5 text-xs font-semibold data-[state=on]:border-primary/40 data-[state=on]:bg-background data-[state=on]:shadow-sm sm:text-sm"
              >
                Tip
                <span className="text-[10px] font-normal text-muted-foreground">Idea</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-title" className="text-xs text-muted-foreground">
              Title (optional)
            </Label>
            <Input
              id="create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a headline"
              className="rounded-xl"
              maxLength={500}
            />
          </div>
          <div className="grid min-h-[220px] gap-2">
            <Label className="text-xs text-muted-foreground">What would you like to share?</Label>
            <CommunityRichEditor
              key={user.id}
              userId={user.id}
              content={body}
              onChange={setBody}
              placeholder="Share kindly — this is not medical advice."
            />
          </div>
        </div>
      </form>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" asChild>
            <Link href="/community">Cancel</Link>
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            className="min-h-11 flex-1 rounded-xl"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting…
              </>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

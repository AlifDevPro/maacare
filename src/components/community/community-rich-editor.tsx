"use client";

import { useCallback } from "react";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ImageIcon, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

export function CommunityRichEditor({
  userId,
  content,
  onChange,
  placeholder = "Write your post…",
  className,
}: {
  userId: string;
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] max-w-none px-3 py-2 text-sm leading-relaxed focus:outline-none prose prose-sm dark:prose-invert [&_img]:max-h-72 [&_img]:rounded-lg",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  const uploadImage = useCallback(
    async (file: File) => {
      const ext = extFromMime(file.type);
      if (!ext) {
        toast.error("Use JPEG, PNG, WebP, or GIF.");
        return null;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error("Image must be 5MB or smaller.");
        return null;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("community-post-images").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          console.error(error);
          toast.error(error.message || "Could not upload image.");
          return null;
        }
        const { data } = supabase.storage.from("community-post-images").getPublicUrl(path);
        return data.publicUrl;
      } catch (e) {
        console.error(e);
        toast.error("Could not upload image.");
        return null;
      }
    },
    [userId],
  );

  if (!editor) {
    return <div className="min-h-[180px] rounded-xl border border-border bg-muted/30 animate-pulse" />;
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-background", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border/80 bg-muted/30 p-1.5">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          className="h-8 px-2"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          className="h-8 px-2"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          className="h-8 px-2"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          className="h-8 px-2"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const url = await uploadImage(f);
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
          />
          <span className="inline-flex h-8 items-center rounded-md px-2 text-sm font-medium text-foreground hover:bg-muted">
            <ImageIcon className="h-4 w-4" />
          </span>
        </label>
        <div className="ml-auto flex gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const { name, email, password } = bodySchema.parse(await req.json());

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          name: name.trim(),
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase().includes("already")
        ? "Email already registered"
        : error.message;
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    if (!data.session) {
      return NextResponse.json({
        ok: true,
        needsEmailConfirmation: true,
        message: "Check your email to confirm your account before signing in.",
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, role, language")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not created" }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        name: profile.display_name,
        email: profile.email ?? data.user.email ?? "",
        role: profile.role,
        language: profile.language === "bn" ? "bn" : "en",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.flatten() }, { status: 400 });
    }

    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

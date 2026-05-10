import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const { email, password } = bodySchema.parse(await req.json());

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, role, language")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 500 });
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
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

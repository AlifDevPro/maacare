import { LoginForm } from "@/app/login/login-form";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSessionFromCookies();
  if (session) {
    redirect("/app");
  }
  return <LoginForm />;
}

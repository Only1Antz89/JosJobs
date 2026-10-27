import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to your Athena Pro company or field team workspace.",
  path: "/auth/login"
});

export default function LoginPage({
  searchParams
}: {
  searchParams?: { redirectTo?: string };
}) {
  return <LoginForm redirectTo={searchParams?.redirectTo} />;
}

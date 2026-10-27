import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Forgot password",
  description:
    "Request a link to reset your Athena Pro password.",
  path: "/auth/forgot-password",
  noIndex: true
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Reset password",
  description:
    "Choose a new password for your Athena Pro account.",
  path: "/auth/reset-password",
  noIndex: true
});

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

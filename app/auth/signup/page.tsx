import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/signup-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Request access",
  description:
    "Create an Athena Pro account as an event company or as a field team operator.",
  path: "/auth/signup"
});

export default function SignupPage() {
  return <SignupForm />;
}

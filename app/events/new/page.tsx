import type { Metadata } from "next";
import { EventCreationForm } from "@/features/organiser/event-creation-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Create an event",
  description:
    "Post a new event and the roles you need filled.",
  path: "/events/new",
  noIndex: true
});

export default function NewEventPage() {
  return <EventCreationForm />;
}

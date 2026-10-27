import type { Metadata } from "next";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { getAdminEmailTemplates } from "@/lib/queries/campaigns";
import { EMAIL_TEMPLATE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Email templates" };

export const dynamic = "force-dynamic";

export default async function TemplateLibraryPage() {
  const templates = await getAdminEmailTemplates();

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Template library"
        title="Athena-branded lifecycle and campaign templates"
        description="These templates cover lifecycle messaging, service-line outreach, finance notices, newsletters, and operational alerts."
      />

      <AdminDataTable
        columns={[
          { key: "name", label: "Template" },
          { key: "type", label: "Type" },
          { key: "subject", label: "Subject" }
        ]}
        rows={templates.map((template) => ({
          id: template.id,
          cells: {
            name: template.name,
            type: EMAIL_TEMPLATE_LABELS[template.templateType],
            subject: template.subjectTemplate
          }
        }))}
      />
    </div>
  );
}

import { BRAND, formatStatusLabel } from "@/lib/brand";
import { SITE_CONTACT } from "@/lib/site-content";
import type { CampaignSummary } from "@/types/admin";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function markdownToHtml(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("### ")) {
        return `<h3>${renderInlineMarkdown(block.slice(4))}</h3>`;
      }

      if (block.startsWith("## ")) {
        return `<h2>${renderInlineMarkdown(block.slice(3))}</h2>`;
      }

      if (block.startsWith("# ")) {
        return `<h1>${renderInlineMarkdown(block.slice(2))}</h1>`;
      }

      if (block.startsWith("- ")) {
        const items = block
          .split("\n")
          .map((item) => item.replace(/^- /, "").trim())
          .filter(Boolean)
          .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
          .join("");

        return `<ul>${items}</ul>`;
      }

      return `<p>${renderInlineMarkdown(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

export function buildCampaignPreviewHtml(campaign: Pick<CampaignSummary, "contentMode" | "htmlContent" | "markdownContent">) {
  if (campaign.contentMode === "markdown") {
    return markdownToHtml(campaign.markdownContent ?? "");
  }

  return campaign.htmlContent;
}

export function renderEmailShell(input: {
  eyebrow: string;
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerHtml?: string;
}) {
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:32px 0 0;"><a href="${input.ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#b9e6ff;color:#0c0f12;text-decoration:none;font-weight:700;">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const officeLine = SITE_CONTACT.registeredOffice.includes("to be inserted")
    ? ""
    : `<div style="margin-top:8px;">Registered office: ${escapeHtml(SITE_CONTACT.registeredOffice)}</div>`;
  const registrationLine =
    "companyRegistration" in SITE_CONTACT &&
    typeof SITE_CONTACT.companyRegistration === "string" &&
    !SITE_CONTACT.companyRegistration.includes("to be inserted")
      ? `<div style="margin-top:4px;">Company registration: ${escapeHtml(SITE_CONTACT.companyRegistration)}</div>`
      : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#0d0f11;color:#f2f3f5;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <div style="padding:32px 16px;background:radial-gradient(circle at top left, rgba(185,230,255,0.12), transparent 25%), linear-gradient(180deg,#171a1e,#0d0f11);">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:28px;background:rgba(24,27,31,0.92);overflow:hidden;">
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#b9e6ff;">${escapeHtml(BRAND.plainName)}</p>
          <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#98a2ad;">${escapeHtml(input.eyebrow)}</p>
          <h1 style="margin:0 0 12px;font-size:34px;line-height:1.05;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 22px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#98a2ad;">${escapeHtml(BRAND.tagline)}</p>
          <div style="font-size:15px;line-height:1.75;color:#d9dde2;">${input.bodyHtml}</div>
          ${ctaHtml}
        </div>
        <div style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#98a2ad;">
          ${escapeHtml(formatStatusLabel("athena_pro"))} · ${escapeHtml(BRAND.concept)}<br />
          <a href="${escapeHtml(SITE_CONTACT.websiteUrl)}" style="color:#b9e6ff;text-decoration:none;">${escapeHtml(SITE_CONTACT.websiteUrl)}</a>
          ·
          <a href="mailto:${escapeHtml(SITE_CONTACT.supportEmail)}" style="color:#b9e6ff;text-decoration:none;">${escapeHtml(SITE_CONTACT.supportEmail)}</a>
          ${officeLine}
          ${registrationLine}
          ${input.footerHtml ? `<div style="margin-top:10px;">${input.footerHtml}</div>` : ""}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

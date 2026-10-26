import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/auth/admin-route";
import { buildExport, isExportType } from "@/lib/services/admin-exports";

export const dynamic = "force-dynamic";

// Downloads a CSV, e.g. /api/admin/exports/invoices
export const GET = adminRoute<{ type: string }>(async (_request, { params, adminUser }) => {
  if (!isExportType(params.type)) {
    return NextResponse.json({ ok: false, error: "Unknown export." }, { status: 404 });
  }

  const { filename, csv } = await buildExport(adminUser, params.type);

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
});

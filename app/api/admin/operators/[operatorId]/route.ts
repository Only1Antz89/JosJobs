import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { getAdminOperatorById } from "@/lib/queries/operators";
import { updateOperator, updateOperatorSchema } from "@/lib/services/admin-mutations";

export const GET = adminRoute<{ operatorId: string }>(async (_request, { params }) => {
  const operator = await getAdminOperatorById(params.operatorId);

  if (!operator) {
    return NextResponse.json({ ok: false, error: "Operator not found." }, { status: 404 });
  }

  return NextResponse.json(operator);
});

export const PATCH = adminRoute<{ operatorId: string }>(
  async (request, { params, adminUser }) => {
    const input = updateOperatorSchema.parse(await readJson(request));
    const result = await updateOperator(adminUser.id, params.operatorId, input);
    return NextResponse.json({ ok: true, warning: result.warning });
  },
  { roles: ["operations_admin"], liveOnly: true }
);

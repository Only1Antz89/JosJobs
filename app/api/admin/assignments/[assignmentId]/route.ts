import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { getAdminAssignmentById } from "@/lib/queries/assignments";
import { updateAssignment, updateAssignmentSchema } from "@/lib/services/admin-mutations";

export const GET = adminRoute<{ assignmentId: string }>(async (_request, { params }) => {
  const assignment = await getAdminAssignmentById(params.assignmentId);

  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Assignment not found." }, { status: 404 });
  }

  return NextResponse.json(assignment);
});

export const PATCH = adminRoute<{ assignmentId: string }>(
  async (request, { params, adminUser }) => {
    const input = updateAssignmentSchema.parse(await readJson(request));
    await updateAssignment(adminUser.id, params.assignmentId, input);
    return NextResponse.json({ ok: true });
  },
  { roles: ["operations_admin", "finance_admin"], liveOnly: true }
);

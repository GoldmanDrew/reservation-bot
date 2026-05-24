import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJobStatus } from "@/lib/db";
import { cancelRunningJob } from "@/lib/sniper/engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  cancelRunningJob(id);
  updateJobStatus(id, "cancelled");
  return NextResponse.json({ ok: true });
}

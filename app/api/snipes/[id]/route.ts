import { NextRequest, NextResponse } from "next/server";
import { deleteJob, getJob, getJobLogs } from "@/lib/db";
import { cancelRunningJob } from "@/lib/sniper/engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const logs = getJobLogs(id);
  return NextResponse.json({ job, logs });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  cancelRunningJob(id);
  deleteJob(id);
  return NextResponse.json({ ok: true });
}

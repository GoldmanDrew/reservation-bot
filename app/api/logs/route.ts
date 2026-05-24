import { NextRequest, NextResponse } from "next/server";
import { getJobLogs } from "@/lib/db";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const since = parseInt(request.nextUrl.searchParams.get("since") ?? "0", 10);

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const logs = getJobLogs(jobId, since);
  return NextResponse.json({ logs });
}

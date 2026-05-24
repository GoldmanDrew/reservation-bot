import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createJob, listJobs } from "@/lib/db";
import { launchJob } from "@/lib/sniper/scheduler";
import type { CreateSnipeInput } from "@/lib/types";

export async function GET() {
  const jobs = listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateSnipeInput;

    if (!body.platform || !body.venueId || !body.restaurantName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!body.targetDate || !body.partySize || !body.preferredTimes?.length) {
      return NextResponse.json(
        { error: "Date, party size, and preferred times required" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const job = createJob(body, id);
    launchJob(id);

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create snipe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [trays, crabs, waterTests, minerals] = await Promise.all([
      db.tray.count(),
      db.crab.count(),
      db.waterTest.count(),
      db.mineral.count(),
    ]);
    return NextResponse.json({
      ok: true,
      database: "postgres",
      counts: { trays, crabs, waterTests, minerals },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

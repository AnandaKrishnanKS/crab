import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildFullExportBundle } from "@/lib/export-bundle";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bundle = await buildFullExportBundle();
    const filename = `mudcrab-backup-${bundle.dateIST}.json`;

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("JSON export failed:", err);
    return NextResponse.json(
      { error: "Failed to generate JSON backup" },
      { status: 500 }
    );
  }
}


import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildFullExportBundle,
  EXPORT_TABLE_DEFINITIONS,
  serializeTableToCsv,
} from "@/lib/export-bundle";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bundle = await buildFullExportBundle();
    const zip = new JSZip();

    for (const def of EXPORT_TABLE_DEFINITIONS) {
      const rows = bundle.tables[def.key];
      const csv = serializeTableToCsv(def.columns, rows);
      zip.file(def.filename, csv);
    }

    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          exportedAt: bundle.exportedAt,
          dateIST: bundle.dateIST,
          app: bundle.app,
          timezone: bundle.timezone,
          rowCounts: Object.fromEntries(
            EXPORT_TABLE_DEFINITIONS.map((def) => [def.key, bundle.tables[def.key].length])
          ),
        },
        null,
        2
      )
    );

    const buffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const filename = `mudcrab-csv-export-${bundle.dateIST}.zip`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("CSV ZIP export failed:", err);
    return NextResponse.json(
      { error: "Failed to generate CSV ZIP export" },
      { status: 500 }
    );
  }
}


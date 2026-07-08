import { NextResponse } from "next/server";
import { buildPortalWorkbook } from "@/lib/portalExcelBuilder";

export async function POST(req: Request) {
  try {
    const { output, projectName } = (await req.json()) as {
      output?: Record<string, unknown>;
      projectName?: string;
    };
    if (!output) {
      return NextResponse.json({ error: "生成済みのポータル原稿がありません" }, { status: 400 });
    }

    const workbook = await buildPortalWorkbook(output);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = encodeURIComponent(`${projectName ?? "ポータル"}_Nexus-by-Homeヒアリングシート.xlsx`);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Portal Excel export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

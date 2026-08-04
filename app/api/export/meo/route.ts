import { NextResponse } from "next/server";
import { buildMeoWorkbook } from "@/lib/meoExcelBuilder";

export async function POST(req: Request) {
  const { output, projectName, hpUrl } = await req.json();

  const workbook = await buildMeoWorkbook(output, projectName ?? "", hpUrl ?? "");
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${projectName || "MEO"}_MEOヒアリングシート.xlsx`);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}

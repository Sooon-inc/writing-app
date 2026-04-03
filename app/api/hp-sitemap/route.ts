import { NextRequest, NextResponse } from "next/server";
import { HP_SITEMAPS } from "@/lib/hpSitemap";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type || !HP_SITEMAPS[type]) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  return NextResponse.json({ pages: HP_SITEMAPS[type] });
}

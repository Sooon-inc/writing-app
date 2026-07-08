import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "writing-app",
    port: 3210,
    checkedAt: new Date().toISOString(),
  });
}

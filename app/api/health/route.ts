import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getDatabaseStatus() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const protocol = (() => {
    try {
      return new URL(databaseUrl).protocol.replace(":", "");
    } catch {
      if (databaseUrl.startsWith("file:")) return "file";
      return "unknown";
    }
  })();

  return {
    configured: Boolean(databaseUrl),
    provider: protocol === "postgres" || protocol === "postgresql" ? "postgresql" : protocol,
    isSQLite: databaseUrl.startsWith("file:"),
    fingerprint: databaseUrl
      ? createHash("sha256").update(databaseUrl).digest("hex").slice(0, 12)
      : null,
  };
}

export async function GET() {
  const database = getDatabaseStatus();

  try {
    const projectCount = await prisma.project.count();

    return NextResponse.json(
      {
        status: "ok",
        app: "writing-app",
        database: {
          ...database,
          canQuery: true,
          projectCount,
        },
        deployment: {
          url: process.env.VERCEL_URL ?? null,
          gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        },
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        status: "error",
        app: "writing-app",
        database: {
          ...database,
          canQuery: false,
        },
        deployment: {
          url: process.env.VERCEL_URL ?? null,
          gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        },
        error: message,
        checkedAt: new Date().toISOString(),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

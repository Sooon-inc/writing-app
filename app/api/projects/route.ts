import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type");
  const projects = await prisma.project.findMany({
    where: type ? { type } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  try {
    const {
      name,
      type,
      hpUrl,
      gbpUrl,
      hearing,
      industries,
      products,
      sitemap,
      hpPageThemes,
    } = await req.json();

    if (typeof name !== "string" || !name.trim() || typeof type !== "string" || !type.trim()) {
      return NextResponse.json(
        { error: "会社名と種別は必須です" },
        { status: 400 }
      );
    }

    const toNullableString = (value: unknown) =>
      typeof value === "string" && value.trim() ? value : null;

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        hpUrl: toNullableString(hpUrl),
        gbpUrl: toNullableString(gbpUrl),
        hearing: toNullableString(hearing),
        industries: toNullableString(industries),
        products: toNullableString(products),
        sitemap: toNullableString(sitemap),
        hpPageThemes: toNullableString(hpPageThemes),
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project", error);

    const message = error instanceof Error ? error.message : String(error);
    const isSQLiteOnProduction =
      process.env.VERCEL === "1" &&
      (process.env.DATABASE_URL ?? "").startsWith("file:");

    return NextResponse.json(
      {
        error: isSQLiteOnProduction
          ? "本番環境のDATABASE_URLがSQLiteになっています。Vercelでは案件保存用にPostgreSQLなどの永続DBが必要です。"
          : `案件の作成に失敗しました: ${message}`,
      },
      { status: 500 }
    );
  }
}

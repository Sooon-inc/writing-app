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

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name,
      type,
      hpUrl: hpUrl || null,
      gbpUrl: gbpUrl || null,
      hearing: hearing || null,
      industries: industries || null,
      products: products || null,
      sitemap: sitemap || null,
      hpPageThemes: hpPageThemes || null,
    },
  });

  return NextResponse.json(project, { status: 201 });
}

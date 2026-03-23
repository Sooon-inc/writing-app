import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
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
  const { name, type } = await req.json();

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: { name, type },
  });

  return NextResponse.json(project, { status: 201 });
}

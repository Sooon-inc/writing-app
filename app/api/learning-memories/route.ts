import { NextRequest, NextResponse } from "next/server";
import { createLearningMemory } from "@/lib/learningMemory";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectId?: string;
      outputType?: string;
      instruction?: string;
      background?: string;
      assistantReply?: string;
      updates?: unknown;
      targets?: unknown;
    };

    if (!body.projectId || !body.outputType || !body.instruction || !body.updates) {
      return NextResponse.json(
        { error: "projectId, outputType, instruction, updates are required" },
        { status: 400 }
      );
    }

    const result = await createLearningMemory({
      projectId: body.projectId,
      outputType: body.outputType,
      instruction: body.instruction,
      background: body.background,
      assistantReply: body.assistantReply,
      updates: body.updates,
      targets: body.targets,
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "学習保存に失敗しました";
    console.error("[learning-memory] save failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

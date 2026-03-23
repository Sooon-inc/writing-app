import { NextResponse } from "next/server";
import { generateWriting } from "@/lib/claude";
import { meoSystemPrompt, meoUserPrompt } from "@/lib/templates/meo";
import { hpSystemPrompt, hpUserPrompt } from "@/lib/templates/hp";
import { lpSystemPrompt, lpUserPrompt } from "@/lib/templates/lp";

export async function POST(req: Request) {
  const { type, hpContent, hearing } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  let systemPrompt: string;
  let userPrompt: string;

  if (type === "meo") {
    systemPrompt = meoSystemPrompt;
    userPrompt = meoUserPrompt(hpContent ?? "", hearing ?? "");
  } else if (type === "lp") {
    systemPrompt = lpSystemPrompt;
    userPrompt = lpUserPrompt(hpContent ?? "", hearing ?? "");
  } else {
    // hp-strong, hp-classic, hp-beauty, hp-recruit
    systemPrompt = hpSystemPrompt(type);
    userPrompt = hpUserPrompt(hpContent ?? "", hearing ?? "");
  }

  try {
    const result = await generateWriting(systemPrompt, userPrompt);
    // Validate JSON output
    const parsed = JSON.parse(result);
    return NextResponse.json({ output: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

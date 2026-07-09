import { prisma } from "@/lib/prisma";

export interface LearningMemoryInput {
  projectId: string;
  outputType: string;
  instruction: string;
  background?: string;
  assistantReply?: string;
  updates: unknown;
  targets?: unknown;
}

interface LearningMemoryRow {
  id: string;
  projectId: string;
  outputType: string;
  instruction: string;
  background: string | null;
  assistantReply: string | null;
  updatesJson: string;
  targetsJson: string | null;
  createdAt: Date;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `learn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export async function createLearningMemory(input: LearningMemoryInput) {
  const id = makeId();
  const instruction = truncate(input.instruction.trim(), 3000);
  const background = input.background ? truncate(input.background.trim(), 5000) : null;
  const assistantReply = input.assistantReply ? truncate(input.assistantReply.trim(), 5000) : null;
  const updatesJson = truncate(JSON.stringify(input.updates ?? {}), 20000);
  const targetsJson = input.targets == null ? null : truncate(JSON.stringify(input.targets), 20000);

  await prisma.learningMemory.create({
    data: {
      id,
      projectId: input.projectId,
      outputType: input.outputType,
      instruction,
      background,
      assistantReply,
      updatesJson,
      targetsJson,
    },
  });

  return { id };
}

export async function listLearningMemories(outputType: string, limit = 8): Promise<LearningMemoryRow[]> {
  return prisma.learningMemory.findMany({
    where: { outputType },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function formatLearningMemoriesForPrompt(memories: LearningMemoryRow[]): string {
  if (memories.length === 0) return "";
  return memories
    .map((memory, index) => {
      const targets = memory.targetsJson ? memory.targetsJson : "対象指定なし";
      return [
        `【学習例 ${index + 1}】`,
        `修正指示: ${memory.instruction}`,
        memory.background ? `修正の背景: ${memory.background}` : "",
        `対象: ${targets}`,
        `適用した修正JSON: ${memory.updatesJson}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

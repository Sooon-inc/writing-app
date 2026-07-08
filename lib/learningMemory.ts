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
  createdAt: string;
}

async function ensureLearningMemoryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS LearningMemory (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      outputType TEXT NOT NULL,
      instruction TEXT NOT NULL,
      background TEXT,
      assistantReply TEXT,
      updatesJson TEXT NOT NULL,
      targetsJson TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE LearningMemory ADD COLUMN background TEXT`);
  } catch {
    // 既に追加済みの場合は無視する
  }
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS LearningMemory_outputType_createdAt_idx
    ON LearningMemory(outputType, createdAt)
  `);
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
  await ensureLearningMemoryTable();
  const id = makeId();
  const instruction = truncate(input.instruction.trim(), 3000);
  const background = input.background ? truncate(input.background.trim(), 5000) : null;
  const assistantReply = input.assistantReply ? truncate(input.assistantReply.trim(), 5000) : null;
  const updatesJson = truncate(JSON.stringify(input.updates ?? {}), 20000);
  const targetsJson = input.targets == null ? null : truncate(JSON.stringify(input.targets), 20000);

  await prisma.$executeRaw`
    INSERT INTO LearningMemory (id, projectId, outputType, instruction, background, assistantReply, updatesJson, targetsJson)
    VALUES (${id}, ${input.projectId}, ${input.outputType}, ${instruction}, ${background}, ${assistantReply}, ${updatesJson}, ${targetsJson})
  `;

  return { id };
}

export async function listLearningMemories(outputType: string, limit = 8): Promise<LearningMemoryRow[]> {
  await ensureLearningMemoryTable();
  return prisma.$queryRaw`
    SELECT id, projectId, outputType, instruction, background, assistantReply, updatesJson, targetsJson, createdAt
    FROM LearningMemory
    WHERE outputType = ${outputType}
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `;
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

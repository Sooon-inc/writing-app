-- CreateTable
CREATE TABLE "LearningMemory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "background" TEXT,
    "assistantReply" TEXT,
    "updatesJson" TEXT NOT NULL,
    "targetsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningMemory_outputType_createdAt_idx" ON "LearningMemory"("outputType", "createdAt");

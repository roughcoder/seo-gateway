-- CreateTable
CREATE TABLE "related_results" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "seed_keyword_id" TEXT NOT NULL,
    "se_type" TEXT,
    "seed_keywords" TEXT[],
    "location_code" INTEGER,
    "language_code" TEXT,
    "total_count" BIGINT,
    "items_count" INTEGER,
    "offset" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "related_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "related_results_task_id_idx" ON "related_results"("task_id");

-- CreateIndex
CREATE INDEX "related_results_seed_keyword_id_idx" ON "related_results"("seed_keyword_id");

-- AddForeignKey
ALTER TABLE "related_results" ADD CONSTRAINT "related_results_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("api_task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_results" ADD CONSTRAINT "related_results_seed_keyword_id_fkey" FOREIGN KEY ("seed_keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

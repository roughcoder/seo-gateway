/*
  Warnings:

  - You are about to drop the column `spell` on the `serps` table. All the data in the column will be lost.
  - The `error_details` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "serps" DROP CONSTRAINT "serps_keyword_id_fkey";

-- DropIndex
DROP INDEX "results_url_idx";

-- DropIndex
DROP INDEX "serps_task_id_key";

-- DropIndex
DROP INDEX "tasks_keyword_idx";

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "version" DROP NOT NULL,
ALTER COLUMN "status_code" DROP NOT NULL,
ALTER COLUMN "status_message" DROP NOT NULL,
ALTER COLUMN "time" DROP NOT NULL,
ALTER COLUMN "cost" DROP NOT NULL,
ALTER COLUMN "tasks_count" DROP NOT NULL,
ALTER COLUMN "tasks_error" DROP NOT NULL;

-- AlterTable
ALTER TABLE "keywords" ADD COLUMN     "kiCompetition" DOUBLE PRECISION,
ADD COLUMN     "kiCompetitionLevel" TEXT,
ADD COLUMN     "kiCpc" DOUBLE PRECISION,
ADD COLUMN     "kiHighTopOfPageBid" DOUBLE PRECISION,
ADD COLUMN     "kiKeywordDifficulty" INTEGER,
ADD COLUMN     "kiLastCheck" TIMESTAMP(3),
ADD COLUMN     "kiLastUpdatedKeywordInfo" TIMESTAMP(3),
ADD COLUMN     "kiLowTopOfPageBid" DOUBLE PRECISION,
ADD COLUMN     "kiMainIntent" TEXT,
ADD COLUMN     "kiSearchVolume" INTEGER;

-- AlterTable
ALTER TABLE "results" ALTER COLUMN "type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "serps" DROP COLUMN "spell",
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "se_domain" DROP NOT NULL,
ALTER COLUMN "location_code" DROP NOT NULL,
ALTER COLUMN "language_code" DROP NOT NULL,
ALTER COLUMN "check_url" DROP NOT NULL,
ALTER COLUMN "fetch_timestamp_from_api" DROP NOT NULL,
ALTER COLUMN "se_results_count" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "path" TEXT[],
ADD COLUMN     "seed_keyword_id" TEXT,
ALTER COLUMN "status_from_api" DROP NOT NULL,
ALTER COLUMN "received_timestamp" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "result_status_code" DROP NOT NULL,
ALTER COLUMN "result_status_message" DROP NOT NULL,
ALTER COLUMN "result_time" DROP NOT NULL,
ALTER COLUMN "result_cost" DROP NOT NULL,
ALTER COLUMN "result_count" DROP NOT NULL,
DROP COLUMN "error_details",
ADD COLUMN     "error_details" JSONB;

-- CreateTable
CREATE TABLE "keyword_relations" (
    "id" TEXT NOT NULL,
    "seed_keyword_id" TEXT NOT NULL,
    "related_keyword_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_relations_task_id_idx" ON "keyword_relations"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_relations_seed_keyword_id_related_keyword_id_key" ON "keyword_relations"("seed_keyword_id", "related_keyword_id");

-- CreateIndex
CREATE INDEX "serps_task_id_idx" ON "serps"("task_id");

-- CreateIndex
CREATE INDEX "serps_keyword_id_idx" ON "serps"("keyword_id");

-- CreateIndex
CREATE INDEX "serps_created_at_idx" ON "serps"("created_at");

-- CreateIndex
CREATE INDEX "tasks_seed_keyword_id_idx" ON "tasks"("seed_keyword_id");

-- AddForeignKey
ALTER TABLE "keyword_relations" ADD CONSTRAINT "keyword_relations_seed_keyword_id_fkey" FOREIGN KEY ("seed_keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_relations" ADD CONSTRAINT "keyword_relations_related_keyword_id_fkey" FOREIGN KEY ("related_keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_relations" ADD CONSTRAINT "keyword_relations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("api_task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serps" ADD CONSTRAINT "serps_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_seed_keyword_id_fkey" FOREIGN KEY ("seed_keyword_id") REFERENCES "keywords"("id") ON DELETE SET NULL ON UPDATE CASCADE;

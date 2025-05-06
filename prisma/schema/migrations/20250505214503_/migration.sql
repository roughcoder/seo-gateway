/*
  Warnings:

  - You are about to drop the column `position` on the `results` table. All the data in the column will be lost.
  - You are about to drop the column `snippet` on the `results` table. All the data in the column will be lost.
  - Added the required column `rank_absolute` to the `results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "results" DROP COLUMN "position",
DROP COLUMN "snippet",
ADD COLUMN     "about_this_result" JSONB,
ADD COLUMN     "amp_version" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breadcrumb" TEXT,
ADD COLUMN     "cache_url" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "extended_people_also_search" JSONB,
ADD COLUMN     "extended_snippet" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "highlighted" TEXT[],
ADD COLUMN     "images" JSONB,
ADD COLUMN     "is_featured_snippet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_image" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_malicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_video" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_web_story" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "layout_position" TEXT,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "pre_snippet" TEXT,
ADD COLUMN     "price" JSONB,
ADD COLUMN     "rank_absolute" INTEGER NOT NULL,
ADD COLUMN     "rank_group" INTEGER,
ADD COLUMN     "rating" JSONB,
ADD COLUMN     "rectangle" JSONB,
ADD COLUMN     "related_result" JSONB,
ADD COLUMN     "related_search_url" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3),
ADD COLUMN     "website_name" TEXT,
ADD COLUMN     "xpath" TEXT;

-- CreateIndex
CREATE INDEX "results_url_idx" ON "results"("url");

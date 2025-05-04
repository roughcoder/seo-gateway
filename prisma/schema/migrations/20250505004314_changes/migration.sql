-- AlterTable
ALTER TABLE "keyword_profiles" ADD COLUMN     "related_keyword_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

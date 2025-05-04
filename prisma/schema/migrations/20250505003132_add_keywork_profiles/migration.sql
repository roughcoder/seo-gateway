-- CreateTable
CREATE TABLE "keyword_profiles" (
    "id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "location_code" INTEGER NOT NULL,
    "language_code" TEXT NOT NULL,
    "ki_last_check" TIMESTAMP(3),
    "ki_competition" DOUBLE PRECISION,
    "ki_competition_level" TEXT,
    "ki_cpc" DOUBLE PRECISION,
    "ki_search_volume" INTEGER,
    "ki_low_top_of_page_bid" DOUBLE PRECISION,
    "ki_high_top_of_page_bid" DOUBLE PRECISION,
    "ki_categories" INTEGER[],
    "ki_monthly_searches" JSONB,
    "kp_synonym_clustering_algorithm" TEXT,
    "kp_keyword_difficulty" INTEGER,
    "kp_detected_language" TEXT,
    "kp_is_another_language" BOOLEAN,
    "avg_backlinks" DOUBLE PRECISION,
    "avg_dofollow" DOUBLE PRECISION,
    "avg_referring_pages" DOUBLE PRECISION,
    "avg_referring_domains" DOUBLE PRECISION,
    "avg_referring_main_domains" DOUBLE PRECISION,
    "avg_rank" DOUBLE PRECISION,
    "avg_main_domain_rank" DOUBLE PRECISION,
    "avg_last_updated_time" TIMESTAMP(3),
    "si_main_intent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_profiles_keyword_id_idx" ON "keyword_profiles"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_profiles_keyword_id_location_code_language_code_key" ON "keyword_profiles"("keyword_id", "location_code", "language_code");

-- AddForeignKey
ALTER TABLE "keyword_profiles" ADD CONSTRAINT "keyword_profiles_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

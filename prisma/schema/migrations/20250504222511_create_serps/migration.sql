-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "request_timestamp" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "status_message" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "tasks_count" INTEGER NOT NULL,
    "tasks_error" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "serp_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serps" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "se_domain" TEXT NOT NULL,
    "location_code" INTEGER NOT NULL,
    "language_code" TEXT NOT NULL,
    "check_url" TEXT NOT NULL,
    "fetch_timestamp_from_api" TIMESTAMP(3) NOT NULL,
    "spell" TEXT,
    "refinement_chips" JSONB,
    "item_types" TEXT[],
    "se_results_count" INTEGER,
    "items_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "api_task_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "status_from_api" TEXT NOT NULL,
    "received_timestamp" TIMESTAMP(3) NOT NULL,
    "result_status_code" INTEGER NOT NULL,
    "result_status_message" TEXT NOT NULL,
    "result_time" TEXT NOT NULL,
    "result_cost" DOUBLE PRECISION NOT NULL,
    "result_count" INTEGER NOT NULL,
    "location" TEXT,
    "search_engine" TEXT,
    "language_code" TEXT,
    "device" TEXT,
    "os" TEXT,
    "depth" INTEGER,
    "error_details" TEXT,
    "result_path" JSONB,
    "result_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("api_task_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keywords_text_key" ON "keywords"("text");

-- CreateIndex
CREATE INDEX "results_serp_id_idx" ON "results"("serp_id");

-- CreateIndex
CREATE INDEX "results_url_idx" ON "results"("url");

-- CreateIndex
CREATE UNIQUE INDEX "serps_task_id_key" ON "serps"("task_id");

-- CreateIndex
CREATE INDEX "tasks_job_id_idx" ON "tasks"("job_id");

-- CreateIndex
CREATE INDEX "tasks_keyword_idx" ON "tasks"("keyword");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_serp_id_fkey" FOREIGN KEY ("serp_id") REFERENCES "serps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serps" ADD CONSTRAINT "serps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("api_task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serps" ADD CONSTRAINT "serps_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

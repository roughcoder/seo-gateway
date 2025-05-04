import { PrismaClient } from "@prisma/client";
import type { Result, Serp } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import axios from "axios";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { insertJob } from "../../../../services/jobs.server.js";
import { findKeywordByName, insertKeyword } from "../../../../services/keywords.server.js";
import { findResultsBySerpId } from "../../../../services/results.server.js";
import { findRecentSerpByKeywordId, insertSerp } from "../../../../services/serps.server.js";
import { insertTask } from "../../../../services/tasks.server.js";

// Helper function to convert BigInt to string for serialization
function serializeSerp(serp: Serp | null): (Omit<Serp, "seResultsCount"> & { seResultsCount: string | null }) | null {
	if (!serp) return null;
	return {
		...serp,
		seResultsCount: serp.seResultsCount?.toString() ?? null,
	};
}

// Interface for the final response structure per keyword
interface KeywordSerpResult {
	keyword: string;
	serp: (Omit<Serp, "seResultsCount"> & { seResultsCount: string | null }) | null;
	results: Result[];
	error?: string; // Add an error field for cases where processing fails for a specific keyword
}

// Initialize Prisma Client (consider a shared instance)
const prisma = new PrismaClient();

// Define the expected request body structure
interface PostBody {
	keywords: string[]; // Changed from keyword: string
	language_code?: string; // Optional: ISO 639-1 language code
	location_code?: number; // Optional: DataForSEO location code
}

// Interface for individual items in the SERP results
interface SerpItem {
	type: string;
	rank_absolute: number;
	url: string;
	title?: string | null;
	description?: string | null;
}

// Interface for the structure of a task object from the DataForSEO API response
interface DataForSeoTask {
	id: string; // Assuming task ID is a string
	status_code: number;
	status_message: string;
	cost: number;
	time: string; // Assuming time is a string like "0.5693169"
	result_count: number;
	resultPath?: string; // Optional path
	data?: {
		keyword?: string;
		tag?: string;
		location_code?: number;
		se?: string;
		language_code?: string;
		device?: string;
		os?: string;
		depth?: number;
		// ... other potential properties within data
	};
	result?: [
		{
			type?: string;
			se_domain?: string;
			location_code?: number;
			language_code?: string;
			check_url?: string;
			datetime: string; // Assuming datetime is an ISO string
			item_types?: string[];
			se_results_count?: number | bigint | string | null; // Handle potential types
			items_count?: number;
			items?: SerpItem[];
			// ... other potential properties within the result item
		},
	];
	// ... other potential top-level task properties
}

const serp: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
	fastify.post<{ Body: PostBody }>(
		"/",
		{
			schema: {
				description: "Get live Google Organic SERP data for multiple keywords via DataForSEO.", // Updated description
				tags: ["keyword", "serp", "dataforseo"],
				summary: "Live Google Organic SERP (Batch)", // Updated summary
				body: {
					type: "object",
					required: ["keywords"], // Changed from keyword
					properties: {
						keywords: {
							type: "array", // Changed to array
							items: { type: "string" }, // Items are strings
							description: "An array of keywords to search for.", // Updated description
						},
						language_code: {
							type: "string",
							nullable: true,
							description: "Optional: ISO 639-1 language code (e.g., 'en', 'es'). Defaults to 'en'.",
						},
						location_code: {
							type: "number",
							nullable: true,
							description:
								"Optional: DataForSEO location code (e.g., 2840 for US). Defaults to 2826 (United Kingdom).", // Update default description if needed
						},
					},
				},
				security: [{ apiKey: [] }],
			},
		},
		async (request: FastifyRequest<{ Body: PostBody }>, reply) => {
			const { keywords, language_code, location_code } = request.body;

			if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
				return reply.badRequest("Missing or invalid 'keywords' array in request body");
			}
			if (keywords.some((kw) => typeof kw !== "string" || kw.trim() === "")) {
				return reply.badRequest("All items in 'keywords' array must be non-empty strings");
			}

			const uniqueKeywords = [...new Set(keywords)]; // Ensure unique keywords
			const finalResults: KeywordSerpResult[] = [];
			const keywordsToFetchLive: string[] = [];
			const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

			// --- BEGIN CACHE CHECK (Iterative) ---
			fastify.log.info(`Starting cache check for keywords: ${uniqueKeywords.join(", ")}`);
			for (const keyword of uniqueKeywords) {
				try {
					const keywordRecord = await findKeywordByName(keyword);
					if (keywordRecord) {
						const cachedSerp = await findRecentSerpByKeywordId(keywordRecord.id, twentyFourHoursAgo);
						if (cachedSerp) {
							const cachedResults = await findResultsBySerpId(cachedSerp.id);
							if (cachedResults && cachedResults.length > 0) {
								// Ensure results are not empty
								fastify.log.info(
									`[Cache HIT] Returning cached SERP data for keyword: ${keyword} (fetched at ${cachedSerp.createdAt})`,
								);
								finalResults.push({
									keyword: keyword,
									serp: serializeSerp(cachedSerp),
									results: cachedResults,
								});
								continue; // Move to the next keyword
							}
							fastify.log.warn(
								`[Cache MISS] Found cached SERP (ID: ${cachedSerp.id}) for keyword ${keyword} but results were empty or missing. Will fetch live.`,
							);
						} else {
							fastify.log.info(`[Cache MISS] No recent SERP found for keyword: ${keyword}`);
						}
					} else {
						fastify.log.info(`[Cache MISS] Keyword not found in database: ${keyword}`);
					}
				} catch (cacheError: unknown) {
					let errorMessage = "Unknown error during cache check";
					if (cacheError instanceof Error) {
						errorMessage = cacheError.message;
					}
					fastify.log.error(
						`Cache check failed for keyword ${keyword}: ${errorMessage}. Will attempt live fetch.`,
					);
					// Proceed to live API call if cache check fails for this keyword
				}
				// If we reach here, it's a cache miss for this keyword
				keywordsToFetchLive.push(keyword);
			}
			fastify.log.info(
				`Cache check complete. Hits: ${finalResults.length}. Misses (to fetch live): ${keywordsToFetchLive.length}`,
			);
			// --- END CACHE CHECK ---

			// --- BEGIN LIVE API CALL & DB INSERTION (if needed) ---
			if (keywordsToFetchLive.length > 0) {
				fastify.log.info(`Proceeding with live API call for keywords: ${keywordsToFetchLive.join(", ")}`);

				const dataForSeoBearerToken = process.env.DATAFORSEO_BEARER;
				if (!dataForSeoBearerToken) {
					fastify.log.error(
						"DataForSEO Bearer token (DATAFORSEO_BEARER) is not configured in environment variables.",
					);
					// Add error entries for keywords that couldn't be fetched due to config error
					for (const kw of keywordsToFetchLive) {
						finalResults.push({
							keyword: kw,
							serp: null,
							results: [],
							error: "Server configuration error.",
						});
					}
					// Still return 200 with partial results/errors if cache had hits
					return reply.send(finalResults);
				}

				const apiEndpoint = "https://api.dataforseo.com/v3/serp/google/organic/live/regular";
				const postData = keywordsToFetchLive.map((keyword) => ({
					keyword: keyword,
					language_code: language_code || "en",
					location_code: location_code || 2826, // Example: US location code
					device: "desktop",
					os: "windows",
					depth: 100,
					tag: keyword, // Use keyword as tag for easy mapping back
				}));

				try {
					const response = await axios.post(apiEndpoint, postData, {
						headers: {
							Authorization: `Basic ${dataForSeoBearerToken}`,
							"Content-Type": "application/json",
						},
					});

					fastify.log.info({
						msg: "Data received from DataForSEO",
						// Avoid logging potentially large full data in production? Maybe just task count/status.
						// data: response.data,
						tasks_count: response.data?.tasks_count,
						tasks_error: response.data?.tasks_error,
					});

					// --- BEGIN DATABASE INSERTION (Concurrent) ---
					const apiResponse = response.data;
					if (!apiResponse || !apiResponse.tasks || apiResponse.tasks.length === 0) {
						throw new Error("Invalid or empty tasks array in DataForSEO response");
					}

					// Insert Job (once for the batch)
					const jobRecord = await insertJob({
						requestTimestamp: new Date(),
						status: "PROCESSING", // Initial status, update later based on task results?
						version: apiResponse.version,
						statusCode: apiResponse.status_code,
						statusMessage: apiResponse.status_message,
						time: apiResponse.time,
						cost: apiResponse.cost,
						tasksCount: apiResponse.tasks_count,
						tasksError: apiResponse.tasks_error,
					});
					if (!jobRecord) {
						throw new Error("Failed to insert master job record.");
					}
					const jobId = jobRecord.id;

					// Helper function to process a single task from the API response
					const processTask = async (taskData: DataForSeoTask): Promise<KeywordSerpResult | null> => {
						const keyword = taskData.data?.keyword || taskData.data?.tag; // Get keyword back from task data or tag
						if (!keyword) {
							fastify.log.error("Could not determine keyword for a task", { taskData });
							return null; // Or return an error entry? Depends on desired handling.
						}

						try {
							if (
								!taskData ||
								taskData.status_code !== 20000 ||
								!taskData.result ||
								!taskData.result.length
							) {
								const errorMsg = `DataForSEO task failed or returned no result for keyword '${keyword}'. Status: ${taskData?.status_code} - ${taskData?.status_message}`;
								fastify.log.error(errorMsg, { taskData });
								throw new Error(errorMsg); // Throw to be caught below
							}

							const serpData = taskData.result[0];

							// 1. Insert/Get Keyword
							const keywordRecord = await insertKeyword(keyword);
							if (!keywordRecord) throw new Error(`Failed to insert/find keyword: ${keyword}`);
							const keywordId = keywordRecord.id;

							// 2. Insert Task (linked to the master job)
							const taskRecord = await insertTask({
								apiTaskId: taskData.id,
								jobId: jobId, // Link to the master job
								keyword: keyword,
								statusFromApi: taskData.status_message,
								receivedTimestamp: new Date(),
								resultStatusCode: taskData.status_code,
								resultStatusMessage: taskData.status_message,
								resultTime: taskData.time,
								resultCost: taskData.cost,
								resultCount: taskData.result_count,
								location: taskData.data?.location_code?.toString(),
								searchEngine: taskData.data?.se,
								languageCode: taskData.data?.language_code,
								device: taskData.data?.device,
								os: taskData.data?.os,
								depth: taskData.data?.depth,
								errorDetails: undefined, // Keep undefined for Prisma optional Json
								resultPath: taskData.resultPath || undefined,
								resultData: taskData.data || undefined, // Use undefined if null/missing
							});
							if (!taskRecord || taskRecord.apiTaskId !== taskData.id) {
								throw new Error(`Failed to insert task record for API task ID: ${taskData.id}`);
							}
							const taskId = taskRecord.apiTaskId; // Use the API Task ID

							// 3. Insert Serp
							const serpRecord = await insertSerp({
								taskId: taskId,
								keywordId: keywordId,
								type: serpData.type ?? "",
								seDomain: serpData.se_domain ?? "",
								locationCode: serpData.location_code ?? 0,
								languageCode: serpData.language_code ?? "",
								checkUrl: serpData.check_url ?? "",
								fetchTimestampFromApi: new Date(serpData.datetime),
								itemTypes: serpData.item_types,
								seResultsCount: Number(serpData.se_results_count) || null,
								itemsCount: serpData.items_count ?? null,
							});
							if (!serpRecord) throw new Error(`Failed to insert SERP record for task ID: ${taskId}`);
							const serpId = serpRecord.id;

							// Fetch the inserted SERP to return it
							const insertedSerp = await prisma.serp.findUnique({ where: { id: serpId } });
							let insertedResults: Result[] = [];

							// 4. Insert Results (Items)
							if (serpData.items && serpData.items.length > 0) {
								const resultsToInsert: Prisma.ResultCreateManyInput[] = serpData.items
									.filter((i: SerpItem) => i.type === "organic")
									.map((item: SerpItem) => ({
										serpId: serpId,
										position: item.rank_absolute,
										url: item.url,
										type: item.type,
										title: item.title,
										snippet: item.description,
									}));

								if (resultsToInsert.length > 0) {
									const insertResultOutcome = await prisma.result.createMany({
										data: resultsToInsert,
										skipDuplicates: true, // Avoid errors if somehow a duplicate position is sent
									});
									fastify.log.info(
										`Inserted ${insertResultOutcome.count} result items for SERP ID: ${serpId}`,
									);
									// Fetch the results we just inserted
									insertedResults = (await findResultsBySerpId(serpId)) ?? []; // Ensure it's an array
								}
							}

							fastify.log.info(
								`Successfully stored DataForSEO results in DB for keyword: ${keyword}. JobID: ${jobId}, TaskID: ${taskId}, SerpID: ${serpId}`,
							);

							return {
								keyword: keyword,
								serp: serializeSerp(insertedSerp),
								results: insertedResults,
							};
						} catch (dbError: unknown) {
							let errorMessage = `Unknown database error during processing task for keyword '${keyword}'`;
							if (dbError instanceof Error) {
								errorMessage = `Error processing task for keyword '${keyword}': ${dbError.message}`;
							}
							fastify.log.error(errorMessage, {
								keyword: keyword,
								taskId: taskData?.id,
								taskData: taskData, // Log the specific task data that failed
							});
							// Return an error entry for this specific keyword
							return {
								keyword: keyword,
								serp: null,
								results: [],
								error: errorMessage, // Include the specific error message
							};
						}
					};

					// Process tasks concurrently
					const processingPromises = apiResponse.tasks.map(processTask);
					const processedResults = await Promise.all(processingPromises);

					// Filter out null results (if any) and add processed results to finalResults
					for (const result of processedResults) {
						if (result) {
							finalResults.push(result);
						}
					}

					// Update Job status based on task results? Maybe too complex for now.
					// Consider updating the job status to COMPLETED or PARTIAL_ERROR etc.
					// await prisma.job.update({ where: { id: jobId }, data: { status: "COMPLETED" }});

					fastify.log.info(
						`Finished processing ${processedResults.length} tasks from DataForSEO for Job ID: ${jobId}`,
					);
					// --- END DATABASE INSERTION ---
				} catch (error: unknown) {
					// This catches errors from the axios call itself or the initial response validation
					let errorMessage = "Unknown error calling DataForSEO API or processing results batch";
					let responseStatus: number | undefined;
					let responseData: unknown;

					if (axios.isAxiosError(error)) {
						errorMessage = error.message;
						responseStatus = error.response?.status;
						responseData = error.response?.data; // Contains API error details
					} else if (error instanceof Error) {
						errorMessage = error.message;
					}

					fastify.log.error(
						`Error processing live SERP request batch for keywords [${keywordsToFetchLive.join(", ")}]: ${errorMessage}`,
						{ responseStatus, responseData },
					);

					// Add error entries for all keywords that were attempted in this failed batch
					for (const kw of keywordsToFetchLive) {
						// Avoid adding duplicates if some keywords already have specific task errors
						if (!finalResults.some((fr) => fr.keyword === kw)) {
							finalResults.push({ keyword: kw, serp: null, results: [], error: errorMessage });
						}
					}
				}
			}
			// --- END LIVE API CALL & DB INSERTION ---

			// Return the combined results (cached + newly fetched/processed)
			// Ensure the order matches the original request? Or is alphabetical ok?
			// For simplicity, the current order depends on cache hits first, then API results order.
			fastify.log.info(`Returning ${finalResults.length} total results for the request.`);
			return reply.send(finalResults);
		},
	);
};

export default serp;

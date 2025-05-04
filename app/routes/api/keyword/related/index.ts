import { type KeywordProfile, Prisma } from "@prisma/client"; // Correct combined import
import axios from "axios"; // Import axios
import type { FastifyPluginAsync } from "fastify";
import { insertJob } from "../../../../services/jobs.server.js";
import { upsertKeywordProfile } from "../../../../services/keyword_profiles.server.js"; // Import keyword profile service
import { findKeywordProfilesByIds, findRecentKeywordProfile } from "../../../../services/keyword_profiles.server.js"; // Import findRecentKeywordProfile, findKeywordProfilesByIds
import { insertKeyword } from "../../../../services/keywords.server.js"; // Import keyword service
import { findKeywordByName } from "../../../../services/keywords.server.js";
import { insertRelatedResult } from "../../../../services/related.server.js"; // Import related result service
import { insertTask } from "../../../../services/tasks.server.js";

// Define the expected body structure (including optional location/language)
interface PostBody {
	// keyword: string;
	keywords: string[]; // Changed to array
	locationCode?: number | null;
	languageCode?: string | null;
}

// Interface for the transformed keyword profile in the response
// Omit fields that are internal or less relevant to the client
type TransformedKeywordProfile = Omit<KeywordProfile, "keyword" | "kiLastCheck" | "createdAt" | "updatedAt"> & {
	keywordText: string | null;
};

// Interface for the final response structure per requested keyword
interface KeywordRelatedResult {
	keyword: string;
	related: KeywordProfile | null; // Profile of the *requested* keyword, linked to related keywords
	keywords: TransformedKeywordProfile[]; // List of related keyword profiles
	error?: string; // Optional error message for this specific keyword
}

const related: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
	fastify.post<{ Body: PostBody }>(
		// Use updated PostBody
		"/",
		{
			schema: {
				description: "Get related keywords for given queries from DataForSEO, with caching.", // Updated description
				tags: ["keyword", "related", "dataforseo", "cached"],
				summary: "Live/Cached Related Keywords (Batch)", // Updated summary
				body: {
					type: "object",
					// required: ["keyword"],
					required: ["keywords"], // Changed to keywords
					properties: {
						// keyword: { type: "string", description: "The keyword to search for." },
						keywords: {
							type: "array",
							items: { type: "string" },
							description: "An array of keywords to search for.",
						},
						locationCode: {
							type: "integer",
							nullable: true,
							default: 2826,
							description: "DataForSEO location code (e.g., 2826 for UK). Defaults to 2826.",
						},
						languageCode: {
							type: "string",
							nullable: true,
							default: "en",
							description: 'DataForSEO language code (e.g., "en"). Defaults to "en".',
						},
					},
				},
				response: {
					// Add other responses like 404 (keyword not found?), 500 etc.
				},
				security: [{ apiKey: [] }],
			},
		},
		async (request, reply) => {
			// const { keyword, locationCode: reqLocationCode, languageCode: reqLanguageCode } = request.body;
			const { keywords, locationCode: reqLocationCode, languageCode: reqLanguageCode } = request.body;
			const locationCode = reqLocationCode ?? 2826; // Use default if null/undefined
			const languageCode = reqLanguageCode ?? "en"; // Use default if null/undefined

			// Input validation
			if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
				return reply.badRequest("Missing or invalid 'keywords' array in request body");
			}
			if (keywords.some((kw) => typeof kw !== "string" || kw.trim() === "")) {
				return reply.badRequest("All items in 'keywords' array must be non-empty strings");
			}

			const uniqueKeywords = [...new Set(keywords.map((kw) => kw.trim()))]; // Trim and ensure unique
			const finalResults: KeywordRelatedResult[] = [];
			const keywordsToFetchLive: string[] = [];
			const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

			// --- Cache Check (Iterative) ---
			fastify.log.info(
				`Starting cache check for keywords: ${uniqueKeywords.join(", ")} [${locationCode}/${languageCode}]`,
			);
			for (const keyword of uniqueKeywords) {
				try {
					const seedKeywordRecord = await findKeywordByName(keyword);
					if (seedKeywordRecord) {
						const cachedProfile = await findRecentKeywordProfile(
							seedKeywordRecord.id,
							locationCode,
							languageCode,
							cutoffDate,
						);

						if (cachedProfile) {
							const relatedIds = cachedProfile.relatedKeywordIds;
							if (relatedIds && relatedIds.length > 0) {
								fastify.log.info(
									`[Cache HIT] Found profile for: ${keyword} [${locationCode}/${languageCode}]`,
								);
								const relatedKeywordProfiles = await findKeywordProfilesByIds(
									relatedIds,
									locationCode,
									languageCode,
								);
								// Transform the profiles for the response
								const transformedKeywords = relatedKeywordProfiles.map(
									(profile): TransformedKeywordProfile => {
										const { keyword: kwData, kiLastCheck, createdAt, updatedAt, ...rest } = profile; // Destructure fields to omit
										return { ...rest, keywordText: kwData?.text ?? null }; // Return remaining fields + keywordText
									},
								);
								fastify.log.debug(
									`Adding cached data for ${keyword}. Profile ID: ${cachedProfile?.id}, Related Count: ${transformedKeywords.length}`,
								); // Simplified log
								finalResults.push({
									keyword: keyword,
									related: cachedProfile,
									keywords: transformedKeywords,
								});
								continue; // Move to next keyword
							}
							fastify.log.info(
								`[Cache MISS] Found profile for ${keyword} but no related IDs. Will fetch live.`,
							);
						} else {
							fastify.log.info(`[Cache MISS] No recent profile found for keyword: ${keyword}`);
						}
					} else {
						fastify.log.info(`[Cache MISS] Seed keyword not found in database: ${keyword}`);
					}
				} catch (cacheError: unknown) {
					let errorMessage = "Unknown error during cache check";
					if (cacheError instanceof Error) {
						errorMessage = cacheError.message;
					}
					fastify.log.error(
						`Cache check failed for keyword ${keyword}: ${errorMessage}. Will attempt live fetch.`,
					);
				}
				// If we reach here, it's a cache miss
				keywordsToFetchLive.push(keyword);
			}
			fastify.log.info(
				`Cache check complete. Hits: ${finalResults.length}. Misses (to fetch live): ${keywordsToFetchLive.length}`,
			);
			// --- End Cache Check ---

			// --- BEGIN LIVE API CALL & DB INSERTION (if needed) ---
			if (keywordsToFetchLive.length > 0) {
				const dataForSeoBearerToken = process.env.DATAFORSEO_BEARER;
				if (!dataForSeoBearerToken) {
					fastify.log.error(
						"DataForSEO Bearer token (DATAFORSEO_BEARER) is not configured in environment variables.",
					);
					// Add error entries for keywords that failed due to config error
					for (const kw of keywordsToFetchLive) {
						finalResults.push({
							keyword: kw,
							related: null,
							keywords: [],
							error: "Server configuration error.",
						});
					}
					return reply.send(finalResults); // Return combined results (including cache hits)
				}

				const apiEndpoint = "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live";
				const postData = [
					{
						// keywords: [keyword],
						keywords: keywordsToFetchLive, // Send all keywords needing fetch
						location_code: locationCode,
						language_code: languageCode,
						limit: 10, // Optional limit
					},
				];

				try {
					fastify.log.info(
						`Fetching related keywords from API for: ${keywordsToFetchLive.join(", ")} [${locationCode}/${languageCode}]`,
					);
					const response = await axios.post(apiEndpoint, postData, {
						headers: {
							Authorization: `Basic ${dataForSeoBearerToken}`,
							"Content-Type": "application/json",
						},
					});

					const taskData = response.data.tasks?.[0];
					if (
						!taskData ||
						taskData.status_code !== 20000 ||
						!taskData.result ||
						taskData.result.length === 0
					) {
						const errorMsg = `API call succeeded but task failed or returned no result for keywords [${keywordsToFetchLive.join(", ")}]. Status: ${taskData?.status_code} - ${taskData?.status_message}`;
						fastify.log.warn(errorMsg, { taskData });
						// Add error entry for all keywords in this batch
						for (const kw of keywordsToFetchLive) {
							finalResults.push({ keyword: kw, related: null, keywords: [], error: errorMsg });
						}
						// Return combined results including cache hits and these errors
						return reply.send(finalResults);
					}

					// --- Database Insertion Logic for Live Batch ---

					// 1. Insert Job (as before)
					const jobRecord = await insertJob({
						requestTimestamp: new Date(),
						status: "COMPLETED",
						statusCode: taskData.status_code,
						statusMessage: taskData.status_message,
						time: taskData.time,
						cost: taskData.cost,
						tasksCount: response.data.tasks_count, // Use main response tasks_count
						tasksError: response.data.tasks_error, // Use main response tasks_error
					});
					if (!jobRecord) throw new Error("Failed to insert job record.");
					const jobId = jobRecord.id;

					// 2. Determine Seed Keyword ID for Task/RelatedResult (using the first keyword for simplicity)
					// This is imperfect as the task relates to the batch, not just the first keyword.
					const primarySeedKeyword = keywordsToFetchLive[0];
					const primarySeedKeywordRecord = await insertKeyword(primarySeedKeyword);
					if (!primarySeedKeywordRecord) {
						throw new Error(
							`Failed to find or create primary seed keyword for task logging: ${primarySeedKeyword}`,
						);
					}
					const primarySeedKeywordId = primarySeedKeywordRecord.id;

					// 3. Insert Task (linked to the Job and primary seed keyword)
					const taskRecord = await insertTask({
						apiTaskId: taskData.id,
						jobId: jobId,
						seedKeywordId: primarySeedKeywordId, // Log against the primary seed kw
						keyword: keywordsToFetchLive.join(", "), // Store all requested keywords for context?
						statusFromApi: taskData.status_message,
						receivedTimestamp: new Date(),
						resultStatusCode: taskData.status_code,
						resultStatusMessage: taskData.status_message,
						resultTime: taskData.time,
						resultCost: taskData.cost,
						resultCount: taskData.result_count,
						location: taskData.data?.location_code?.toString(),
						path: taskData.path,
						searchEngine: taskData.data?.se_type,
						languageCode: taskData.data?.language_code,
						device: taskData.data?.device,
						os: taskData.data?.os,
						depth: taskData.data?.depth,
						errorDetails: undefined,
						resultData: taskData.data,
					});
					if (!taskRecord || taskRecord.apiTaskId !== taskData.id) {
						throw new Error(`Failed to insert task record for API task ID: ${taskData.id}`);
					}
					const taskId = taskRecord.apiTaskId;

					// 4. Insert Related Result Metadata (linked to Task and primary seed keyword)
					const resultMetadata = taskData.result?.[0];
					if (resultMetadata && primarySeedKeywordId) {
						const relatedResultRecord = await insertRelatedResult({
							taskId: taskId,
							seedKeywordId: primarySeedKeywordId, // Link to primary seed
							seType: resultMetadata.se_type,
							// seedKeywords: resultMetadata.seed_keywords,
							seedKeywords: keywordsToFetchLive, // Store actual requested keywords
							locationCode: resultMetadata.location_code,
							languageCode: resultMetadata.language_code,
							totalCount: resultMetadata.total_count,
							itemsCount: resultMetadata.items_count,
							offset: resultMetadata.offset,
						});
						if (!relatedResultRecord) {
							fastify.log.warn(`Failed to insert related result metadata for Task ID: ${taskId}`);
						}
					} else {
						fastify.log.warn(
							`Skipping related result metadata insertion for Task ID: ${taskId} due to missing data or primarySeedKeywordId.`,
						);
					}

					// 5. Process Items & Upsert Profiles, Collect related IDs
					const items = resultMetadata?.items;
					const collectedRelatedKeywordIds: string[] = [];
					const transformedKeywords: TransformedKeywordProfile[] = []; // Initialize transformed array

					if (Array.isArray(items)) {
						fastify.log.info(`Processing ${items.length} related keyword items from API...`);
						for (const item of items) {
							if (!item.keyword || !item.location_code || !item.language_code) {
								fastify.log.warn(
									"Skipping item due to missing keyword, location_code, or language_code:",
									item,
								);
								continue;
							}

							const itemKeywordRecord = await insertKeyword(item.keyword);
							if (!itemKeywordRecord) {
								fastify.log.error(
									`Failed to find or create keyword record for item: ${item.keyword}. Skipping profile upsert.`,
								);
								continue;
							}
							const itemKeywordId = itemKeywordRecord.id;
							collectedRelatedKeywordIds.push(itemKeywordId);

							const profileData = {
								keywordId: itemKeywordId,
								locationCode: item.location_code,
								languageCode: item.language_code,
								kiLastCheck: item.keyword_info?.last_updated_time
									? new Date(item.keyword_info.last_updated_time)
									: null,
								kiCompetition: item.keyword_info?.competition,
								kiCompetitionLevel: item.keyword_info?.competition_level,
								kiCpc: item.keyword_info?.cpc,
								kiSearchVolume: item.keyword_info?.search_volume,
								kiLowTopOfPageBid: item.keyword_info?.low_top_of_page_bid,
								kiHighTopOfPageBid: item.keyword_info?.high_top_of_page_bid,
								kiCategories: item.keyword_info?.categories ?? [],
								kiMonthlySearches: item.keyword_info?.monthly_searches ?? Prisma.JsonNull,
								kpSynonymClusteringAlgorithm: item.keyword_properties?.synonym_clustering_algorithm,
								kpKeywordDifficulty: item.keyword_properties?.keyword_difficulty,
								kpDetectedLanguage: item.keyword_properties?.detected_language,
								kpIsAnotherLanguage: item.keyword_properties?.is_another_language,
								avgBacklinks: item.avg_backlinks_info?.backlinks,
								avgDofollow: item.avg_backlinks_info?.dofollow,
								avgReferringPages: item.avg_backlinks_info?.referring_pages,
								avgReferringDomains: item.avg_backlinks_info?.referring_domains,
								avgReferringMainDomains: item.avg_backlinks_info?.referring_main_domains,
								avgRank: item.avg_backlinks_info?.rank,
								avgMainDomainRank: item.avg_backlinks_info?.main_domain_rank,
								avgLastUpdatedTime: item.avg_backlinks_info?.last_updated_time
									? new Date(item.avg_backlinks_info.last_updated_time)
									: null,
								siMainIntent: item.search_intent_info?.main_intent,
							};

							const profileRecord = await upsertKeywordProfile(profileData);
							if (profileRecord) {
								fastify.log.info(
									`Upserted KeywordProfile ID: ${profileRecord.id} for Keyword: ${item.keyword}`,
								);
								// processedItemProfiles.push(profileRecord); // Store successfully processed profile
								// Transform and add directly
								const { kiLastCheck, createdAt, updatedAt, ...rest } = profileRecord;
								transformedKeywords.push({
									...rest,
									keywordText: item.keyword, // Use keyword text directly from item
								});
							} else {
								fastify.log.error(`Failed to upsert KeywordProfile for Keyword: ${item.keyword}`);
							}
						}
					} else {
						fastify.log.warn(
							`No items found in result metadata for Task ID: ${taskId} to process for keyword profiles.`,
						);
					}

					// 6. Update Seed Keyword Profiles with ALL Related IDs & Prepare Response
					// const transformedKeywords = processedItemProfiles.map((profile): TransformedKeywordProfile => {
					// 	const { keyword: kwData, kiLastCheck, createdAt, updatedAt, ...rest } = profile;
					// 	return { ...rest, keywordText: kwData?.text ?? null };
					// });
					// transformedKeywords array is now populated directly in the loop above

					for (const keyword of keywordsToFetchLive) {
						let finalSeedProfile: KeywordProfile | null = null;
						try {
							const seedKeywordRecord = await insertKeyword(keyword);
							if (seedKeywordRecord) {
								const seedProfileData = {
									keywordId: seedKeywordRecord.id,
									locationCode: locationCode,
									languageCode: languageCode,
									relatedKeywordIds: collectedRelatedKeywordIds, // Link all collected IDs
								};
								finalSeedProfile = await upsertKeywordProfile(seedProfileData);
								if (finalSeedProfile) {
									fastify.log.info(
										`Updated seed profile ${finalSeedProfile.id} for ${keyword} with ${collectedRelatedKeywordIds.length} related keyword IDs.`,
									);
								} else {
									fastify.log.error(`Failed to update seed profile for keyword: ${keyword}`);
								}
							}
							// Add to final results even if profile update failed, show what we have
							finalResults.push({
								keyword: keyword,
								related: finalSeedProfile,
								keywords: transformedKeywords,
							});
						} catch (seedUpdateError: unknown) {
							const errorMsg =
								seedUpdateError instanceof Error
									? seedUpdateError.message
									: "Unknown error updating seed profile";
							fastify.log.error(`Error updating seed profile for keyword ${keyword}: ${errorMsg}`);
							finalResults.push({
								keyword: keyword,
								related: null,
								keywords: transformedKeywords, // Still return related keywords found
								error: `Failed to update seed profile: ${errorMsg}`,
							});
						}
					}
				} catch (error: unknown) {
					// This catches errors from the axios call, job/task insertion, or item processing loop
					let errorMessage = "Unknown error during live fetch or processing batch";
					let responseStatus: number | undefined;
					let responseData: unknown;

					if (axios.isAxiosError(error)) {
						errorMessage = error.message;
						responseStatus = error.response?.status;
						responseData = error.response?.data;
					} else if (error instanceof Error) {
						errorMessage = error.message;
					}

					fastify.log.error(
						`Error processing related keywords batch for [${keywordsToFetchLive.join(", ")}]: ${errorMessage}`,
						{ responseStatus, responseData },
					);

					// Add error entries for all keywords attempted in this failed batch
					for (const kw of keywordsToFetchLive) {
						// Avoid adding duplicates if some keywords already got added with specific errors
						if (!finalResults.some((fr) => fr.keyword === kw)) {
							finalResults.push({ keyword: kw, related: null, keywords: [], error: errorMessage });
						}
					}
				}
			}
			// --- END LIVE API CALL & DB INSERTION ---

			fastify.log.info(`Returning ${finalResults.length} total results for the request.`);
			return reply.send(finalResults);
		},
	);
};

export default related;

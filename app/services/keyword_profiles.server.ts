import { Prisma, PrismaClient } from "@prisma/client";
import type { KeywordProfile } from "@prisma/client";

// Define the selection object
const keywordProfileWithKeywordSelect = {
	id: true,
	keywordId: true,
	locationCode: true,
	languageCode: true,
	kiCompetition: true,
	kiCompetitionLevel: true,
	kiCpc: true,
	kiSearchVolume: true,
	kiLowTopOfPageBid: true,
	kiHighTopOfPageBid: true,
	kiCategories: true,
	kiMonthlySearches: true, // Explicitly select
	kpSynonymClusteringAlgorithm: true,
	kpKeywordDifficulty: true,
	kpDetectedLanguage: true,
	kpIsAnotherLanguage: true,
	avgBacklinks: true,
	avgDofollow: true,
	avgReferringPages: true,
	avgReferringDomains: true,
	avgReferringMainDomains: true,
	avgRank: true,
	avgMainDomainRank: true,
	avgLastUpdatedTime: true,
	siMainIntent: true,
	relatedKeywordIds: true,
	// We still need kiLastCheck, createdAt, updatedAt for potential internal use or transformation
	kiLastCheck: true,
	createdAt: true,
	updatedAt: true,
	// Select the included keyword
	keyword: {
		select: {
			id: true,
			text: true,
		},
	},
};

// Define a type based on the selection
type KeywordProfileWithKeyword = Prisma.KeywordProfileGetPayload<{ select: typeof keywordProfileWithKeywordSelect }>;

const prisma = new PrismaClient();

/**
 * Represents the data needed to create or update a KeywordProfile record.
 * Matches the fields in the KeywordProfile model, excluding id, createdAt, updatedAt.
 */
interface UpsertKeywordProfileData {
	keywordId: string;
	locationCode: number;
	languageCode: string;
	kiLastCheck?: string | Date | null;
	kiCompetition?: number | null;
	kiCompetitionLevel?: string | null;
	kiCpc?: number | null;
	kiSearchVolume?: number | null;
	kiLowTopOfPageBid?: number | null;
	kiHighTopOfPageBid?: number | null;
	kiCategories?: number[];
	kiMonthlySearches?: Prisma.InputJsonValue;
	kpSynonymClusteringAlgorithm?: string | null;
	kpKeywordDifficulty?: number | null;
	kpDetectedLanguage?: string | null;
	kpIsAnotherLanguage?: boolean | null;
	avgBacklinks?: number | null;
	avgDofollow?: number | null;
	avgReferringPages?: number | null;
	avgReferringDomains?: number | null;
	avgReferringMainDomains?: number | null;
	avgRank?: number | null;
	avgMainDomainRank?: number | null;
	avgLastUpdatedTime?: string | Date | null;
	siMainIntent?: string | null;
	relatedKeywordIds?: string[];
}

/**
 * Creates a new KeywordProfile or updates an existing one based on the unique
 * combination of keywordId, locationCode, and languageCode.
 *
 * @param data The data for the KeywordProfile to upsert.
 * @returns The created or updated KeywordProfile object, or null if an error occurred.
 */
export async function upsertKeywordProfile(
	data: UpsertKeywordProfileData,
): Promise<Prisma.KeywordProfileGetPayload<null> | null> {
	const { keywordId, locationCode, languageCode, ...updateData } = data;

	// Ensure kiMonthlySearches is handled correctly for JSON field
	const preparedUpdateData = {
		...updateData,
		kiMonthlySearches: updateData.kiMonthlySearches ?? Prisma.JsonNull,
		relatedKeywordIds: updateData.relatedKeywordIds,
	};

	try {
		const upsertedProfile = await prisma.keywordProfile.upsert({
			where: {
				// Use the named unique identifier defined in the schema
				keyword_location_language_unique: {
					keywordId,
					locationCode,
					languageCode,
				},
			},
			update: preparedUpdateData, // Data to use if record exists
			create: {
				// Data to use if record doesn't exist
				keywordId,
				locationCode,
				languageCode,
				...preparedUpdateData, // Spread the rest of the data
			},
		});
		console.log(`Successfully upserted KeywordProfile with ID: ${upsertedProfile.id}`);
		return upsertedProfile;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// P2003: Foreign key constraint violation (keywordId)
			if (error.code === "P2003") {
				console.error(
					`Prisma Error: Foreign key constraint failed on field 'keywordId' for KeywordProfile upsert. Keyword ID ${keywordId} may not exist.`,
					error.message,
				);
			} else {
				console.error(
					`Prisma error upserting KeywordProfile for keywordId ${keywordId}:`,
					error.message,
					`Code: ${error.code}`,
				);
			}
		} else {
			console.error(`Unknown error upserting KeywordProfile for keywordId ${keywordId}:`, error);
		}
		return null; // Indicate failure
	}
}

/**
 * Finds the most recent KeywordProfile matching the criteria, updated within the cutoff date.
 *
 * @param keywordId The ID of the keyword.
 * @param locationCode The location code.
 * @param languageCode The language code.
 * @param cutoffDate The oldest acceptable updatedAt timestamp.
 * @returns The KeywordProfile object if found and recent, otherwise null.
 */
export async function findRecentKeywordProfile(
	keywordId: string,
	locationCode: number,
	languageCode: string,
	cutoffDate: Date,
): Promise<KeywordProfile | null> {
	try {
		const profile = await prisma.keywordProfile.findFirst({
			where: {
				keywordId: keywordId,
				locationCode: locationCode,
				languageCode: languageCode,
				updatedAt: {
					gte: cutoffDate, // Updated at or after the cutoff date
				},
			},
			orderBy: {
				updatedAt: "desc", // Get the most recent one if multiple match somehow
			},
		});
		return profile;
	} catch (error) {
		console.error(`Error finding recent KeywordProfile for keywordId ${keywordId}:`, error);
		return null;
	}
}

/**
 * Finds KeywordProfile records matching a list of keyword IDs, location code, and language code.
 *
 * @param keywordIds An array of keyword IDs.
 * @param locationCode The location code.
 * @param languageCode The language code.
 * @returns An array of matching KeywordProfile objects, including the related Keyword.
 */
export async function findKeywordProfilesByIds(
	keywordIds: string[],
	locationCode: number,
	languageCode: string,
): Promise<KeywordProfileWithKeyword[]> {
	// Update return type
	if (!keywordIds || keywordIds.length === 0) {
		return [];
	}
	try {
		const profiles = await prisma.keywordProfile.findMany({
			where: {
				keywordId: {
					in: keywordIds,
				},
				locationCode: locationCode,
				languageCode: languageCode,
			},
			select: keywordProfileWithKeywordSelect, // Use the explicit select
		});
		return profiles;
	} catch (error) {
		console.error("Error finding KeywordProfiles by IDs, location, language:", error);
		return []; // Return empty array on error
	}
}

// Add other keyword profile service functions if needed.

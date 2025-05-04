import { Prisma, PrismaClient } from "@prisma/client";

// Reuse Prisma client instance (consider moving to a shared db module)
const prisma = new PrismaClient();

/**
 * Represents the data needed to create a new SERP record.
 * Assumes Prisma maps JSONB to Prisma.JsonValue and TEXT[] to string[].
 */
interface CreateSerpData {
	taskId: string;
	keywordId: string;
	type: string;
	seDomain: string;
	locationCode: number;
	languageCode: string;
	checkUrl: string;
	fetchTimestampFromApi: Date;
	refinementChips?: Prisma.JsonValue | null; // Prisma typically maps JSONB to this
	itemTypes?: string[] | null; // Prisma typically maps TEXT[] to this
	seResultsCount?: number | null;
	itemsCount?: number | null;
}

/**
 * Inserts a new SERP into the database.
 *
 * @param serpData The data for the SERP to insert.
 * @returns The ID of the newly created SERP, or null if insertion failed (e.g., duplicate task ID, foreign key violation).
 */
export async function insertSerp(serpData: CreateSerpData): Promise<{ id: string } | null> {
	try {
		const newSerp = await prisma.serp.create({
			data: {
				taskId: serpData.taskId,
				keywordId: serpData.keywordId,
				type: serpData.type,
				seDomain: serpData.seDomain,
				locationCode: serpData.locationCode,
				languageCode: serpData.languageCode,
				checkUrl: serpData.checkUrl,
				fetchTimestampFromApi: serpData.fetchTimestampFromApi,
				refinementChips: serpData.refinementChips ?? Prisma.JsonNull,
				itemTypes: serpData.itemTypes ?? undefined,
				seResultsCount: serpData.seResultsCount,
				itemsCount: serpData.itemsCount,
			},
			select: {
				// Only return the ID
				id: true,
			},
		});
		console.log(`Successfully inserted SERP with ID: ${newSerp.id} for Task ID: ${serpData.taskId}`);
		return newSerp;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// P2002: Unique constraint violation (likely on task_id)
			if (error.code === "P2002") {
				// Extract the field(s) causing the violation, if available
				const target = (error.meta?.target as string[])?.join(", ") ?? "unknown field";
				console.warn(
					`Prisma Warn: Unique constraint violated on field(s) '${target}' for Task ID '${serpData.taskId}'. SERP likely already exists.`,
				);
				// Optionally, find and return the existing SERP ID here if needed
			}
			// P2003: Foreign key constraint failed (on keyword_id or task_id - though task_id FK seems redundant given unique constraint)
			else if (error.code === "P2003") {
				const fieldName = (error.meta?.field_name as string) ?? "unknown field";
				console.error(
					`Prisma Error: Foreign key constraint failed on field '${fieldName}' inserting SERP for Task ID '${serpData.taskId}'. Does the related record exist?`,
					error.message,
				);
			} else {
				console.error(
					`Prisma error inserting SERP for Task ID '${serpData.taskId}':`,
					error.message,
					`Code: ${error.code}`,
				);
			}
		} else {
			console.error(`Unknown error inserting SERP for Task ID '${serpData.taskId}':`, error);
		}
		return null; // Indicate failure
	}
}

/**
 * Finds the most recent SERP for a given keyword ID created after a specific timestamp.
 * Includes the related Task data.
 *
 * @param keywordId The ID of the keyword.
 * @param since The timestamp after which the SERP must have been created.
 * @returns The most recent Serp object (including its Task), or null if not found.
 */
export async function findRecentSerpByKeywordId(
	keywordId: string,
	since: Date,
): Promise<Prisma.SerpGetPayload<{ include: { task: true } }> | null> {
	try {
		const serp = await prisma.serp.findFirst({
			where: {
				keywordId: keywordId,
				createdAt: {
					gte: since, // Greater than or equal to the 'since' timestamp
				},
			},
			orderBy: {
				createdAt: "desc", // Get the most recent one
			},
			include: {
				// Include the related task data
				task: true,
			},
		});
		return serp;
	} catch (error) {
		console.error(`Error finding recent SERP for keywordId '${keywordId}':`, error);
		return null;
	}
}

// Add other SERP-related service functions here as needed.
// e.g., export async function findSerpByTaskId(taskId: string) { ... }
// e.g., export async function findSerpsByKeywordId(keywordId: string) { ... }

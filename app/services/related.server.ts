import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Represents the data needed to create a new related result metadata record.
 */
interface CreateRelatedResultData {
	taskId: string;
	seedKeywordId: string;
	seType?: string | null;
	seedKeywords: string[];
	locationCode?: number | null;
	languageCode?: string | null;
	totalCount?: bigint | number | null; // Prisma expects bigint, allow number for easier input
	itemsCount?: number | null;
	offset?: number | null;
}

/**
 * Inserts a new related result metadata record into the database.
 *
 * @param data The data for the related result to insert.
 * @returns The newly created RelatedResult object (or specific fields), or null if insertion failed.
 */
export async function insertRelatedResult(data: CreateRelatedResultData): Promise<{ id: string } | null> {
	try {
		const newRelatedResult = await prisma.relatedResult.create({
			data: {
				taskId: data.taskId,
				seedKeywordId: data.seedKeywordId,
				seType: data.seType,
				seedKeywords: data.seedKeywords,
				locationCode: data.locationCode,
				languageCode: data.languageCode,
				// Ensure totalCount is converted to BigInt if it's a number
				totalCount: typeof data.totalCount === "number" ? BigInt(data.totalCount) : data.totalCount,
				itemsCount: data.itemsCount,
				offset: data.offset,
			},
			select: {
				// Only return the ID for now
				id: true,
			},
		});
		console.log(`Successfully inserted related result metadata with ID: ${newRelatedResult.id}`);
		return newRelatedResult;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// P2003: Foreign key constraint failed (taskId or seedKeywordId)
			if (error.code === "P2003") {
				const fieldName = (error.meta?.field_name as string) ?? "unknown field";
				console.error(
					`Prisma Error: Foreign key constraint failed on field '${fieldName}' inserting RelatedResult. Does the related Task/Keyword exist?`,
					error.message,
				);
			} else {
				console.error("Prisma error inserting RelatedResult:", error.message, "Code:", error.code);
			}
		} else {
			console.error("Unknown error inserting RelatedResult:", error);
		}
		return null; // Indicate failure
	}
}

// Add other related result service functions here as needed (e.g., find by task ID).

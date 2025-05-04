import { Prisma, PrismaClient, type Result } from "@prisma/client";

// Reuse Prisma client instance (consider moving to a shared db module)
const prisma = new PrismaClient();

/**
 * Represents the data needed to create a new result record.
 */
interface CreateResultData {
	serpId: string;
	position: number;
	url: string;
	type: string;
	title?: string | null; // Optional fields
	snippet?: string | null; // Optional fields
}

/**
 * Inserts a new result into the database.
 *
 * @param resultData The data for the result to insert.
 * @returns The ID of the newly created result, or null if insertion failed.
 */
export async function insertResult(resultData: CreateResultData): Promise<{ id: string } | null> {
	try {
		const newResult = await prisma.result.create({
			data: {
				serpId: resultData.serpId,
				position: resultData.position,
				url: resultData.url,
				type: resultData.type,
				title: resultData.title, // Prisma handles undefined/null correctly for optional fields
				snippet: resultData.snippet,
			},
			select: {
				// Only return the ID
				id: true,
			},
		});
		console.log(`Successfully inserted result with ID: ${newResult.id} for SERP ID: ${resultData.serpId}`);
		return newResult;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// Handle specific Prisma errors, e.g., P2003 Foreign key constraint failed
			if (error.code === "P2003") {
				console.error(
					`Prisma Error: Foreign key constraint failed inserting result for SERP ID '${resultData.serpId}'. Does the SERP exist?`,
					error.message,
				);
			} else {
				console.error(
					`Prisma error inserting result for SERP ID '${resultData.serpId}':`,
					error.message,
					`Code: ${error.code}`,
				);
			}
		} else {
			console.error(`Unknown error inserting result for SERP ID '${resultData.serpId}':`, error);
		}
		return null; // Indicate failure
	}
}

/**
 * Finds all Result records associated with a specific SERP ID.
 *
 * @param serpId The ID of the SERP.
 * @returns An array of Result objects, or null if an error occurs.
 */
export async function findResultsBySerpId(serpId: string): Promise<Result[] | null> {
	try {
		const results = await prisma.result.findMany({
			where: {
				serpId: serpId,
			},
			orderBy: {
				position: "asc", // Order by rank/position
			},
		});
		return results;
	} catch (error) {
		console.error(`Error finding results for SERP ID '${serpId}':`, error);
		return null;
	}
}

// Add other result-related service functions here as needed.
// e.g., export async function findResultsBySerpId(serpId: string) { ... }
// e.g., export async function findResultByUrl(url: string) { ... }

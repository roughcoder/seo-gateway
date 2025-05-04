import { Prisma, PrismaClient } from "@prisma/client";

// It's often good practice to initialize PrismaClient once and export it
// For simplicity here, we'll create it directly, but consider a shared instance
const prisma = new PrismaClient();

/**
 * Inserts a new keyword into the database.
 * Handles potential unique constraint violations gracefully.
 *
 * @param text The keyword text to insert.
 * @returns An object containing the keyword id and text { id: string, text: string }, or null if an error occurred.
 */
export async function insertKeyword(text: string): Promise<{ id: string; text: string } | null> {
	const lowerCaseText = text.toLowerCase(); // Store keywords in lowercase for consistency
	try {
		const newKeyword = await prisma.keyword.create({
			data: {
				text: lowerCaseText,
			},
			select: {
				// Select only id and text
				id: true,
				text: true,
			},
		});
		console.log(`Successfully inserted keyword: ${newKeyword.text}`);
		return newKeyword;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// Handle unique constraint violation (code P2002)
			if (error.code === "P2002") {
				console.warn(`Keyword already exists: ${lowerCaseText}`);
				// Fetch and return the existing keyword's id and text
				try {
					const existingKeyword = await prisma.keyword.findUnique({
						where: { text: lowerCaseText },
						select: {
							// Select only id and text
							id: true,
							text: true,
						},
					});
					return existingKeyword;
				} catch (findError) {
					console.error(`Error fetching existing keyword '${lowerCaseText}':`, findError);
					return null; // Indicate failure to find the existing one
				}
			} else {
				console.error(`Prisma error inserting keyword '${lowerCaseText}':`, error.message);
			}
		} else {
			console.error(`Unknown error inserting keyword '${lowerCaseText}':`, error);
		}
		return null; // Indicate failure
	}
}

/**
 * Finds a keyword by its text.
 *
 * @param text The text of the keyword to find (will be converted to lowercase).
 * @returns An object containing the keyword's id { id: string }, or null if not found.
 */
export async function findKeywordByName(text: string): Promise<{ id: string } | null> {
	const lowerCaseText = text.toLowerCase();
	try {
		const keyword = await prisma.keyword.findFirst({
			where: {
				text: lowerCaseText, // Use 'text' field and lowercase
			},
			select: {
				id: true,
			},
		});
		return keyword;
	} catch (error) {
		console.error(`Error finding keyword by text '${lowerCaseText}':`, error);
		return null;
	}
}

/**
 * Finds multiple keywords by their IDs.
 *
 * @param ids An array of keyword IDs to find.
 * @returns An array of Keyword objects found.
 */
export async function findKeywordsByIds(ids: string[]): Promise<Prisma.KeywordGetPayload<null>[]> {
	if (!ids || ids.length === 0) {
		return []; // Return empty array if no IDs provided
	}
	try {
		const keywords = await prisma.keyword.findMany({
			where: {
				id: {
					in: ids,
				},
			},
		});
		return keywords;
	} catch (error) {
		console.error("Error finding keywords by IDs:", error);
		return []; // Return empty array on error
	}
}

// Consider adding other keyword-related functions here, e.g.:
// export async function findKeyword(text: string) { ... }
// export async function findOrCreateKeyword(text: string) { ... } // This might replace the insert logic

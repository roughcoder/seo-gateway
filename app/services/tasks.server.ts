import { Prisma, PrismaClient } from "@prisma/client";

// Reuse Prisma client instance (consider moving to a shared db module)
const prisma = new PrismaClient();

/**
 * Represents the data needed to create a new task record.
 * The provided apiTaskId will be mapped to the underlying 'id' field in Prisma.
 */
interface CreateTaskData {
	apiTaskId: string; // The logical identifier from the API
	jobId: string;
	keyword: string;
	statusFromApi: string;
	receivedTimestamp: Date;
	resultStatusCode: number;
	resultStatusMessage: string;
	resultTime: string;
	resultCost: number;
	resultCount: number;
	location?: string | null;
	path?: string[]; // Added optional path field for the API path array
	searchEngine?: string | null;
	languageCode?: string | null;
	device?: string | null;
	os?: string | null;
	depth?: number | null;
	errorDetails?: Prisma.InputJsonValue; // Optional, non-nullable
	resultPath?: Prisma.InputJsonValue; // Optional, non-nullable (kept for compatibility)
	resultData?: Prisma.InputJsonValue; // Optional, non-nullable
	seedKeywordId?: string | null; // Ensure this is present and optional
}

/**
 * Inserts a new task into the database.
 *
 * @param taskData The data for the task to insert.
 * @returns An object containing the original apiTaskId { apiTaskId: string }, or null if insertion failed.
 */
export async function insertTask(taskData: CreateTaskData): Promise<{ apiTaskId: string } | null> {
	try {
		const newTask = await prisma.task.create({
			data: {
				// Map fields to Prisma model (assuming PK is 'id')
				id: taskData.apiTaskId, // Map incoming apiTaskId to Prisma's 'id' field
				jobId: taskData.jobId,
				seedKeywordId: taskData.seedKeywordId, // Map optional seedKeywordId
				keyword: taskData.keyword,
				statusFromApi: taskData.statusFromApi,
				receivedTimestamp: taskData.receivedTimestamp,
				resultStatusCode: taskData.resultStatusCode,
				resultStatusMessage: taskData.resultStatusMessage,
				resultTime: taskData.resultTime,
				resultCost: taskData.resultCost,
				resultCount: taskData.resultCount,
				location: taskData.location,
				path: taskData.path, // Map the new optional path array
				searchEngine: taskData.searchEngine,
				languageCode: taskData.languageCode,
				device: taskData.device,
				os: taskData.os,
				depth: taskData.depth,
				errorDetails: taskData.errorDetails ?? Prisma.JsonNull,
				resultData: taskData.resultData ?? Prisma.JsonNull,
			},
			select: {
				// Select Prisma's 'id' field
				id: true,
			},
		});
		// newTask is now { id: string }
		console.log(`Successfully inserted task with ID: ${newTask.id} (API Task ID: ${taskData.apiTaskId})`);
		// Return the original apiTaskId in the expected format
		return { apiTaskId: newTask.id };
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// P2002: Unique constraint violation (now likely on 'id' which corresponds to api_task_id)
			if (error.code === "P2002") {
				console.warn(`Prisma Warn: Task with ID (API Task ID) '${taskData.apiTaskId}' already exists.`);
			}
			// P2003: Foreign key constraint failed (on job_id)
			else if (error.code === "P2003") {
				const fieldName = (error.meta?.field_name as string) ?? "unknown field";
				console.error(
					`Prisma Error: Foreign key constraint failed on field '${fieldName}' inserting Task for API Task ID '${taskData.apiTaskId}'. Does the related record (Job) exist?`,
					error.message,
				);
			} else {
				console.error(
					`Prisma error inserting Task for API Task ID '${taskData.apiTaskId}':`,
					error.message,
					`Code: ${error.code}`,
				);
			}
		} else {
			console.error(`Unknown error inserting Task for API Task ID '${taskData.apiTaskId}':`, error);
		}
		return null; // Indicate failure
	}
}

// Add other Task-related service functions here as needed.
// e.g., export async function findTaskById(apiTaskId: string) { ... } // Will need to query by id: apiTaskId
// e.g., export async function findTasksByJobId(jobId: string) { ... }

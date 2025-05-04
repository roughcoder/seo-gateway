import { Prisma, PrismaClient } from "@prisma/client";

// Reuse Prisma client instance (consider moving to a shared db module)
const prisma = new PrismaClient();

/**
 * Represents the data needed to create a new job record.
 */
interface CreateJobData {
	requestTimestamp: Date;
	status: string;
	statusCode: number;
	statusMessage: string;
	version?: string;
	time: string;
	cost: number;
	tasksCount: number;
	tasksError: number;
}

/**
 * Inserts a new job into the database.
 *
 * @param jobData The data for the job to insert.
 * @returns The ID of the newly created job, or null if insertion failed.
 */
export async function insertJob(jobData: CreateJobData): Promise<{ id: string } | null> {
	try {
		const newJob = await prisma.job.create({
			data: {
				requestTimestamp: jobData.requestTimestamp,
				status: jobData.status,
				statusCode: jobData.statusCode,
				version: jobData.version,
				statusMessage: jobData.statusMessage,
				time: jobData.time,
				cost: jobData.cost,
				tasksCount: jobData.tasksCount,
				tasksError: jobData.tasksError,
			},
			select: {
				// Only return the ID
				id: true,
			},
		});
		console.log(`Successfully inserted job with ID: ${newJob.id}`);
		return newJob;
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// Handle specific Prisma errors if needed, e.g., unique constraints (though none are obvious for Job yet)
			console.error("Prisma error inserting job:", error.message, "Code:", error.code);
		} else {
			console.error("Unknown error inserting job:", error);
		}
		return null; // Indicate failure
	}
}

// Add other job-related service functions here as needed.
// e.g., export async function findJobById(id: string) { ... }
// e.g., export async function updateJobStatus(id: string, status: string) { ... }

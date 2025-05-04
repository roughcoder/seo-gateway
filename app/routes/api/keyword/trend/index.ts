import type { FastifyPluginAsync } from "fastify";

const trend: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
	fastify.get(
		"/",
		{
			schema: {
				description: "Get trend data for a keyword.",
				tags: ["keyword"],
				summary: "Keyword Trend Data",
				// Add query parameter schema later if needed
				response: {
					200: {
						description: "Successful response",
						type: "array",
						items: { type: "string" }, // Placeholder response type
					},
				},
				security: [{ apiKey: [] }], // Indicates API key is required
			},
		},
		async (request, reply) => {
			// Placeholder implementation
			return ["trend data point 1", "trend data point 2", "trend data point 3"];
		},
	);
};

export default trend;

import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

// IMPORTANT: In a real application, load this key securely from environment variables!
const VALID_API_KEY = process.env.API_KEY || "YOUR_SECRET_API_KEY"; // Replace with your actual key mechanism

async function apiKeyAuth(fastify: FastifyInstance, options: FastifyPluginOptions) {
	fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
		// Only apply this hook to routes under /api
		if (!request.url.startsWith("/api/")) {
			return;
		}

		const apiKey = request.headers["x-api-key"];

		if (!apiKey || apiKey !== VALID_API_KEY) {
			// Use sensible plugin for standard errors
			// @ts-ignore - httpErrors is added by @fastify/sensible registered globally
			throw fastify.httpErrors.unauthorized("Invalid or missing API key");
		}
	});
}

export default fp(apiKeyAuth);

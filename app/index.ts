import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyAutoload from "@fastify/autoload";
import fastifySensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv"; // Import dotenv
import Fastify from "fastify";

// Load environment variables from .env file
dotenv.config();

// --- ES Module equivalent for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End ES Module __dirname Setup ---

const server = Fastify({
	logger: true, // Enable logging (basic)
});

// Register essential plugins
server.register(fastifySensible);

// --- Swagger Documentation Setup ---
server.register(fastifySwagger, {
	swagger: {
		info: {
			title: "SEO Gateway API",
			description: "API endpoints for SEO data",
			version: "0.1.0",
		},
		externalDocs: {
			url: "https://swagger.io",
			description: "Find more info here",
		},
		host: "localhost:3000", // Adjust if needed
		schemes: ["http"],
		consumes: ["application/json"],
		produces: ["application/json"],
		tags: [{ name: "keyword", description: "Keyword related end-points" }],
		securityDefinitions: {
			apiKey: {
				type: "apiKey",
				name: "x-api-key",
				in: "header",
			},
		},
	},
});

server.register(fastifySwaggerUi, {
	routePrefix: "/docs",
	uiConfig: {
		docExpansion: "list", // or 'full' or 'none'
		deepLinking: false,
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
});
// --- End Swagger Setup ---

// Register API Key Auth Plugin (will apply hook globally)
server.register(fastifyAutoload, {
	dir: path.join(__dirname, "plugins"),
	options: Object.assign({}), // Pass options if needed
	ignoreFilter: (path) => path.includes("tsconfig"), // Example filter
	dirNameRoutePrefix: false, // Don't prefix routes based on dir names
});

// Serve static files from 'public' folder at the root '/' route
server.register(fastifyStatic, {
	root: path.join(__dirname, "..", "public"), // Go up one level from dist/app to project root, then public
	prefix: "/", // optional: default '/'
});

// Auto-load routes from the 'routes/api' directory
server.register(fastifyAutoload, {
	dir: path.join(__dirname, "routes", "api"), // Point autoload to the 'api' subdirectory
	options: Object.assign({}), // No global prefix needed here, structure comes from dirs
	ignoreFilter: (path) => path.includes("tsconfig"), // Example filter
	dirNameRoutePrefix: true, // Use directory names like 'keyword', 'serp' to build the route path
});

// --- Start Server ---
const start = async () => {
	try {
		// Define the port from environment variable or default to 3000
		const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
		await server.listen({ port: port, host: "0.0.0.0" }); // Listen on all interfaces
		server.log.info(`Server listening on port ${port}`);
		server.log.info(`API documentation available at http://localhost:${port}/docs`);
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

start();

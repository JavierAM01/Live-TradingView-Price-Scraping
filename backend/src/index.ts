import { AppService } from "./gen/app_connect";
import { TestRequest, TestResponse } from "./gen/app_pb";
import { ConnectRouter } from "@connectrpc/connect";
import { fastify } from "fastify";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import cors from "@fastify/cors";

import { setupPlaywright, scrapeAllTickers, gracefulShutdown } from "./server";


// Define the ConnectRPC service implementation for AppService
const routes = (router: ConnectRouter) => {
  router.service(AppService, {

    async getHelloWorld(request: TestRequest): Promise<TestResponse> {
      console.log(`[Backend - getHelloWorld] Received TestRequest from client with name: ${request.name}`);
      return new TestResponse({
        message: `Hello World!`,
      });
    },

  });

};

// Create a Fastify app and register the ConnectRPC plugin
async function main() {
  const app = fastify();

  // Register the CORS plugin BEFORE the ConnectRPC plugin.
  // This allows requests from your frontend's origin (http://localhost:3000)
  // to reach the ConnectRPC services.
  await app.register(cors, {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true, // If you plan to send cookies or authorization headers
  });

  // Register the ConnectRPC plugin with the defined routes
  await app.register(fastifyConnectPlugin, {
    routes: routes,
  });

  // Start the server
  const port = 3001;
  await app.listen({ port });
  console.log(`Backend server listening on http://localhost:${port}`);
  console.log(`ConnectRPC services available at http://localhost:${port}/app.AppService`); // Updated service path

  // Listen for termination signals
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // Start backend browser for prices
  (async () => {
    await setupPlaywright();
    console.log('Backend Server started! Waiting for client requests...');
    setInterval(scrapeAllTickers, 1000); 
  })();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

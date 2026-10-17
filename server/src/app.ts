import Fastify, { type FastifyInstance } from "fastify";

export type BuildAppOptions = {
  checkDatabase: () => Promise<void>;
  logger?: boolean;
};

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get("/health", async (request, reply) => {
    try {
      await options.checkDatabase();
      return {
        database: "ok",
        service: "chentu-server",
        status: "ok",
        time: new Date().toISOString(),
      };
    } catch (error) {
      request.log.warn({ error }, "database health check failed");
      return reply.code(503).send({
        database: "unavailable",
        service: "chentu-server",
        status: "unavailable",
      });
    }
  });

  return app;
}

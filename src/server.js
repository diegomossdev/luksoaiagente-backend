import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";

// Importar rotas
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";

// Carregar variáveis de ambiente
dotenv.config();

const fastify = Fastify({
  logger:
    process.env.NODE_ENV === "production"
      ? false
      : {
          level: process.env.LOG_LEVEL || "info",
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
            },
          },
        },
});

// Configurar CORS
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || [
    "http://localhost:3001",
    "http://localhost:5173",
    "https://luksoaiagente-frontend-1hi4woqfe-diego-mossmanns-projects.vercel.app",
    "https://luksoaiagente-frontend.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});

// Registrar rotas
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(chatRoutes, { prefix: "/api/chat" });
await fastify.register(adminRoutes, { prefix: "/api/admin" });

// Rota de health check
fastify.get("/health", async (request, reply) => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});

// Rota raiz
fastify.get("/", async (request, reply) => {
  return {
    message: "LuksoAI Backend API",
    version: "1.0.0",
    documentation: "/docs",
  };
});

// Handler para rotas não encontradas
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: "Rota não encontrada",
    message: `${request.method} ${request.url} não existe`,
    statusCode: 404,
  });
});

// Handler global de erros
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // Erro de validação
  if (error.validation) {
    return reply.status(400).send({
      error: "Dados inválidos",
      message: error.message,
      details: error.validation,
    });
  }

  // Erro genérico
  return reply.status(error.statusCode || 500).send({
    error: "Erro interno do servidor",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Algo deu errado",
  });
});

// Função para iniciar o servidor (apenas para desenvolvimento local)
const start = async () => {
  try {
    const host = process.env.HOST || "0.0.0.0";
    const port = process.env.PORT || 3000;

    await fastify.listen({
      port: parseInt(port),
      host,
    });

    console.log(`🚀 Servidor rodando em http://${host}:${port}`);
    console.log(`📋 Health check: http://${host}:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    console.error("❌ Erro ao iniciar o servidor:", err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🔴 Recebido sinal ${signal}, encerrando servidor...`);

  try {
    await fastify.close();
    console.log("✅ Servidor encerrado com sucesso");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao encerrar servidor:", err);
    process.exit(1);
  }
};

// Iniciar servidor apenas em desenvolvimento
if (process.env.NODE_ENV !== "production") {
  // Capturar sinais de encerramento
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Capturar erros não tratados
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Iniciar servidor
  start();
}

// Export handler para Vercel
export default async function handler(req, res) {
  await fastify.ready();
  fastify.server.emit("request", req, res);
}

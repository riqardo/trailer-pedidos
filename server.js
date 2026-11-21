import "dotenv/config";
import { createApp } from "./src/app.js";
import { connectDatabase, disconnectDatabase } from "./src/db.js";
import { seedDatabase } from "./src/seed.js";
import { config } from "./src/config.js";

async function main() {
  await connectDatabase();
  await seedDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log("");
    console.log("  Trailer do Bigode — Pedidos");
    console.log(`  Aplicação:  http://localhost:${config.port}`);
    console.log(`  Swagger:    http://localhost:${config.port}/docs`);
    console.log(`  OpenAPI:    http://localhost:${config.port}/api/openapi.yaml`);
    console.log("");
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[app] Encerrando (${signal})...`);

    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[app] Falha ao iniciar:", error);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { load as loadYaml } from "js-yaml";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter } from "./routes/orders.js";
import { addonsRouter } from "./routes/addons.js";
import { apiNotFound, errorHandler } from "./middleware/error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const openapiPath = path.join(__dirname, "..", "docs", "openapi.yaml");

const openapiDocument = loadYaml(fs.readFileSync(openapiPath, "utf8"));

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "trailer-do-bigode-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/addons", addonsRouter);
  app.use("/api/orders", ordersRouter);

  app.get("/api/openapi.yaml", (_req, res) => {
    res.type("application/yaml").sendFile(openapiPath);
  });

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, {
      customSiteTitle: "Trailer do Bigode — API",
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );

  app.get("/api/docs", (_req, res) => res.redirect("/docs/"));

  app.use(express.static(publicDir));

  app.use("/api", apiNotFound);
  app.use(errorHandler);

  return app;
}

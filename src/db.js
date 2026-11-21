import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "./config.js";

let mongoServer = null;

export async function connectDatabase() {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: config.dbName },
  });

  await mongoose.connect(mongoServer.getUri(), { dbName: config.dbName });
  console.log("[banco] MongoDB em memoria iniciado e conectado.");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }

  console.log("[banco] MongoDB em memoria finalizado.");
}

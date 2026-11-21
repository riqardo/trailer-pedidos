const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  nodeEnv: env.NODE_ENV || "development",
  jwtSecret: env.JWT_SECRET || "trailer-do-bigode-dev-secret",
  jwtExpiresIn: env.JWT_EXPIRES_IN || "12h",
  dbName: env.DB_NAME || "trailer_do_bigode",
};

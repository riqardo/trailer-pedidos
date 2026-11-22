import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { unauthorized } from "../utils/http-error.js";

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? "";

  if (!header.startsWith("Bearer ")) {
    throw unauthorized("Envie o token no cabeçalho Authorization: Bearer <token>.");
  }

  const token = header.slice("Bearer ".length).trim();
  let payload;

  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized("Token inválido ou expirado. Faça login novamente.");
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    throw unauthorized("Usuário não encontrado ou inativo.");
  }

  req.user = user;
  next();
}

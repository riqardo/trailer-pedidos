import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { badRequest, unauthorized } from "../utils/http-error.js";
import { publicUser } from "../utils/serializers.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  const password = req.body?.password;

  if (!username || typeof password !== "string" || !password) {
    throw badRequest(
      "INVALID_CREDENTIALS",
      "Informe usuário e senha.",
    );
  }

  const user = await User.findOne({ username }).select("+passwordHash");
  const passwordMatches =
    user && user.active ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    throw unauthorized("Usuário ou senha inválidos.");
  }

  const token = jwt.sign(
    { sub: String(user._id), username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );

  res.json({
    token,
    tokenType: "Bearer",
    expiresIn: config.jwtExpiresIn,
    user: publicUser(user),
  });
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

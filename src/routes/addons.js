import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { listAddons } from "../data/addons.js";

export const addonsRouter = Router();

addonsRouter.use(authenticate);

addonsRouter.get("/", (_req, res) => {
  res.json({ addons: listAddons() });
});

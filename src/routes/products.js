import { Router } from "express";
import { Product } from "../models/Product.js";
import { authenticate } from "../middleware/auth.js";
import { validationError } from "../utils/http-error.js";
import { serializeProduct } from "../utils/serializers.js";

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get("/", async (req, res) => {
  const filter = {};

  if (req.query.available !== undefined) {
    if (!["true", "false"].includes(req.query.available)) {
      throw validationError("O filtro available deve ser true ou false.");
    }
    filter.available = req.query.available === "true";
  }

  if (req.query.category !== undefined) {
    if (!["lanche", "bebida"].includes(req.query.category)) {
      throw validationError("A categoria deve ser lanche ou bebida.");
    }
    filter.category = req.query.category;
  }

  const products = await Product.find(filter).sort({ sortOrder: 1, name: 1 });

  res.json({
    products: products.map(serializeProduct),
    meta: { total: products.length },
  });
});

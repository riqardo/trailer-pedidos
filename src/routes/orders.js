import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  addOrderItem,
  createOrder,
  finalizeOrder,
  getOrder,
  listOrders,
  removeOrderItem,
  updateOrder,
  updateOrderItem,
} from "../services/orders.js";
import { serializeOrder } from "../utils/serializers.js";

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.get("/", async (req, res) => {
  const { orders, meta } = await listOrders(req.query, req.user);
  res.json({
    orders: orders.map((order) =>
      serializeOrder(order, { includeHistory: false }),
    ),
    meta,
  });
});

ordersRouter.post("/", async (req, res) => {
  const order = await createOrder(req.body, req.user);
  res.status(201).json({ order: serializeOrder(order) });
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await getOrder(req.params.id, req.user);
  res.json({ order: serializeOrder(order) });
});

ordersRouter.patch("/:id", async (req, res) => {
  const order = await updateOrder(req.params.id, req.body, req.user);
  res.json({ order: serializeOrder(order) });
});

ordersRouter.post("/:id/items", async (req, res) => {
  const order = await addOrderItem(req.params.id, req.body, req.user);
  res.status(201).json({ order: serializeOrder(order) });
});

ordersRouter.patch("/:id/items/:productId", async (req, res) => {
  const order = await updateOrderItem(
    req.params.id,
    req.params.productId,
    req.body,
    req.user,
  );
  res.json({ order: serializeOrder(order) });
});

ordersRouter.delete("/:id/items/:productId", async (req, res) => {
  const order = await removeOrderItem(
    req.params.id,
    req.params.productId,
    req.user,
  );
  res.json({ order: serializeOrder(order) });
});

ordersRouter.post("/:id/finalize", async (req, res) => {
  const order = await finalizeOrder(req.params.id, req.body, req.user);
  res.json({ order: serializeOrder(order) });
});

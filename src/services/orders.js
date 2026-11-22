import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Counter } from "../models/Counter.js";
import { AuditLog } from "../models/AuditLog.js";
import { calculateTotals, fromCents, toCents } from "../utils/money.js";
import {
  badRequest,
  conflict,
  notFound,
  validationError,
} from "../utils/http-error.js";

const LOCATION_TYPES = ["mesa", "placa", "balcao"];
const PAYMENT_METHODS = ["dinheiro", "pix", "cartao"];
const MAX_QUANTITY = 99;

function attendantFromUser(user) {
  return {
    userId: user._id,
    name: user.name,
    username: user.username,
  };
}

function normalizeCustomerName(value) {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw validationError("Informe o nome do cliente (mínimo de 2 caracteres).");
  }

  if (value.trim().length > 80) {
    throw validationError("O nome do cliente deve ter no máximo 80 caracteres.");
  }

  return value.trim();
}

function normalizeLocation(value) {
  if (!value || typeof value !== "object") {
    throw validationError("Informe o local do cliente (mesa, placa ou balcão).");
  }

  if (!LOCATION_TYPES.includes(value.type)) {
    throw validationError(
      "Tipo de local inválido. Use mesa, placa ou balcao.",
    );
  }

  if (value.type === "balcao") {
    return { type: "balcao", label: "Balcão" };
  }

  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!label) {
    throw validationError(
      value.type === "mesa"
        ? "Informe o número da mesa."
        : "Informe a identificação da placa.",
    );
  }

  if (label.length > 40) {
    throw validationError("A identificação do local deve ter no máximo 40 caracteres.");
  }

  return { type: value.type, label };
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw validationError(
      `A quantidade deve ser um número inteiro entre 1 e ${MAX_QUANTITY}.`,
    );
  }
  return quantity;
}

async function buildItems(rawItems, existingItems = []) {
  if (!Array.isArray(rawItems)) {
    throw validationError("A lista de itens é obrigatória.");
  }

  const existingByProduct = new Map(
    existingItems.map((item) => [String(item.productId), item]),
  );

  const merged = new Map();
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      throw validationError("Item inválido na lista de itens.");
    }
    if (!mongoose.isValidObjectId(rawItem.productId)) {
      throw validationError("Identificador de produto inválido.");
    }

    const productId = String(rawItem.productId);
    const quantity = normalizeQuantity(rawItem.quantity);
    const current = merged.get(productId);
    merged.set(productId, {
      quantity: Math.min(
        MAX_QUANTITY,
        (current?.quantity ?? 0) + quantity,
      ),
    });
  }

  if (merged.size === 0) {
    return [];
  }

  const products = await Product.find({ _id: { $in: [...merged.keys()] } });
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const items = [];
  for (const [productId, entry] of merged) {
    const product = productsById.get(productId);
    if (!product) {
      throw notFound(`Produto ${productId} não encontrado.`);
    }

    const existing = existingByProduct.get(productId);
    if (!product.available && !existing) {
      throw conflict(
        "PRODUCT_UNAVAILABLE",
        `O produto "${product.name}" está indisponível e não pode ser adicionado.`,
        { productId, productName: product.name },
      );
    }

    const unitPrice = product.available ? product.price : existing.unitPrice;
    const name = product.available ? product.name : existing.name;
    const category = product.available ? product.category : existing.category;

    items.push({
      productId: product._id,
      name,
      category,
      unitPrice,
      quantity: entry.quantity,
      lineTotal: fromCents(toCents(unitPrice) * entry.quantity),
    });
  }

  return items;
}

function applyTotals(order) {
  const totals = calculateTotals(order.items, null);
  order.subtotal = totals.subtotal;
  order.discount = 0;
  order.total = totals.total;
}

function pushHistory(order, action, attendant, details = null) {
  order.history.push({ action, attendant, at: new Date(), details });
}

async function recordAudit(action, attendant, order, details = null) {
  await AuditLog.create({
    action,
    order: order?._id ?? null,
    orderNumber: order?.number ?? null,
    attendant,
    details,
  });
}

async function findOrderOrThrow(orderId) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw notFound("Pedido não encontrado.");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw notFound("Pedido não encontrado.");
  }
  return order;
}

function ensureOpen(order) {
  if (order.status !== "open") {
    throw conflict(
      "ORDER_FINALIZED",
      "Este pedido já foi finalizado e está disponível apenas para consulta.",
    );
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listOrders(query, user) {
  const status = query.status ?? "all";
  if (!["open", "finalized", "all"].includes(status)) {
    throw badRequest(
      "INVALID_STATUS",
      "Filtro de status inválido. Use open, finalized ou all.",
    );
  }

  const filter = {};
  if (status !== "all") {
    filter.status = status;
  }

  if (query.locationType) {
    if (!LOCATION_TYPES.includes(query.locationType)) {
      throw validationError("Filtro de local inválido.");
    }
    filter["location.type"] = query.locationType;
  }

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const searchConditions = [
      { customerName: regex },
      { "location.label": regex },
    ];

    if (/^\d+$/.test(search)) {
      searchConditions.push({ number: Number(search) });
    }

    filter.$or = searchConditions;
  }

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(query.limit, 10) || 100),
  );

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .select("-history")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const attendant = attendantFromUser(user);
  await recordAudit("orders.listed", attendant, null, {
    filters: { status, search: search || null, locationType: query.locationType || null },
    returnedOrderIds: orders.map((order) => String(order._id)),
    returnedCount: orders.length,
  });

  return {
    orders,
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getOrder(orderId, user) {
  const order = await findOrderOrThrow(orderId);
  const attendant = attendantFromUser(user);

  const viewedEntry = {
    action: "viewed",
    attendant,
    at: new Date(),
    details: null,
  };

  await Order.updateOne(
    { _id: order._id },
    { $push: { history: viewedEntry } },
    { timestamps: false },
  );
  order.history.push(viewedEntry);

  await recordAudit("order.viewed", attendant, order);

  return order;
}

export async function createOrder(payload, user) {
  const attendant = attendantFromUser(user);
  const customerName = normalizeCustomerName(payload?.customerName);
  const location = normalizeLocation(payload?.location);

  const rawItems = payload?.items ?? [];
  const items = await buildItems(rawItems);

  const counter = await Counter.findByIdAndUpdate(
    "order",
    { $inc: { seq: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  const order = new Order({
    number: counter.seq,
    customerName,
    location,
    items,
    status: "open",
    createdBy: attendant,
    updatedBy: attendant,
  });

  applyTotals(order);
  pushHistory(order, "created", attendant, {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: order.total,
  });

  await order.save();
  await recordAudit("order.created", attendant, order);

  return order;
}

export async function updateOrder(orderId, payload, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  const attendant = attendantFromUser(user);
  const changes = {};
  let hasChanges = false;

  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "customerName")) {
    const customerName = normalizeCustomerName(payload.customerName);
    if (customerName !== order.customerName) {
      changes.customerName = { from: order.customerName, to: customerName };
    }
    order.customerName = customerName;
    hasChanges = true;
  }

  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "location")) {
    const location = normalizeLocation(payload.location);
    if (
      location.type !== order.location.type ||
      location.label !== order.location.label
    ) {
      changes.location = {
        from: { type: order.location.type, label: order.location.label },
        to: location,
      };
    }
    order.location = location;
    hasChanges = true;
  }

  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "items")) {
    const items = await buildItems(payload.items, order.items);
    changes.items = {
      fromCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      toCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
    order.items = items;
    hasChanges = true;
  }

  if (!hasChanges) {
    throw validationError(
      "Informe ao menos um campo para atualizar: customerName, location ou items.",
    );
  }

  order.updatedBy = attendant;
  applyTotals(order);
  pushHistory(order, "updated", attendant, { changes });

  await order.save();
  await recordAudit("order.updated", attendant, order, { changes });

  return order;
}

export async function addOrderItem(orderId, payload, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  if (!mongoose.isValidObjectId(payload?.productId)) {
    throw validationError("Identificador de produto inválido.");
  }

  const quantity = normalizeQuantity(payload?.quantity);
  const product = await Product.findById(payload.productId);

  if (!product) {
    throw notFound("Produto não encontrado.");
  }
  if (!product.available) {
    throw conflict(
      "PRODUCT_UNAVAILABLE",
      `O produto "${product.name}" está indisponível e não pode ser adicionado.`,
      { productId: String(product._id), productName: product.name },
    );
  }

  const attendant = attendantFromUser(user);
  const existing = order.items.find(
    (item) => String(item.productId) === String(product._id),
  );

  if (existing) {
    if (existing.quantity + quantity > MAX_QUANTITY) {
      throw validationError(
        `A quantidade máxima por produto é ${MAX_QUANTITY}.`,
      );
    }
    const before = existing.quantity;
    existing.quantity += quantity;
    existing.lineTotal = fromCents(toCents(existing.unitPrice) * existing.quantity);
    pushHistory(order, "item_added", attendant, {
      productId: String(product._id),
      productName: existing.name,
      quantityAdded: quantity,
      quantityBefore: before,
      quantityAfter: existing.quantity,
    });
  } else {
    order.items.push({
      productId: product._id,
      name: product.name,
      category: product.category,
      unitPrice: product.price,
      quantity,
      lineTotal: fromCents(toCents(product.price) * quantity),
    });
    pushHistory(order, "item_added", attendant, {
      productId: String(product._id),
      productName: product.name,
      quantityAdded: quantity,
      quantityBefore: 0,
      quantityAfter: quantity,
    });
  }

  order.updatedBy = attendant;
  applyTotals(order);

  await order.save();
  await recordAudit("order.item_added", attendant, order, {
    productId: String(product._id),
    productName: product.name,
    quantity,
  });

  return order;
}

export async function updateOrderItem(orderId, productId, payload, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  const quantity = normalizeQuantity(payload?.quantity);
  const item = order.items.find(
    (current) => String(current.productId) === String(productId),
  );

  if (!item) {
    throw notFound("Produto não encontrado neste pedido.");
  }

  const attendant = attendantFromUser(user);
  const before = item.quantity;
  item.quantity = quantity;
  item.lineTotal = fromCents(toCents(item.unitPrice) * quantity);

  order.updatedBy = attendant;
  applyTotals(order);
  pushHistory(order, "item_updated", attendant, {
    productId: String(item.productId),
    productName: item.name,
    quantityBefore: before,
    quantityAfter: quantity,
  });

  await order.save();
  await recordAudit("order.item_updated", attendant, order, {
    productId: String(item.productId),
    productName: item.name,
    quantityBefore: before,
    quantityAfter: quantity,
  });

  return order;
}

export async function removeOrderItem(orderId, productId, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  const itemIndex = order.items.findIndex(
    (current) => String(current.productId) === String(productId),
  );

  if (itemIndex === -1) {
    throw notFound("Produto não encontrado neste pedido.");
  }

  const [removed] = order.items.splice(itemIndex, 1);
  const attendant = attendantFromUser(user);

  order.updatedBy = attendant;
  applyTotals(order);
  pushHistory(order, "item_removed", attendant, {
    productId: String(removed.productId),
    productName: removed.name,
    quantity: removed.quantity,
  });

  await order.save();
  await recordAudit("order.item_removed", attendant, order, {
    productId: String(removed.productId),
    productName: removed.name,
    quantity: removed.quantity,
  });

  return order;
}

export async function finalizeOrder(orderId, payload, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  if (!order.items.length) {
    throw validationError(
      "Um pedido só pode ser finalizado se possuir pelo menos um produto.",
    );
  }

  const paymentMethod = payload?.paymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw validationError(
      "Forma de pagamento inválida. Use dinheiro, pix ou cartao.",
    );
  }

  const totals = calculateTotals(order.items, paymentMethod);
  const attendant = attendantFromUser(user);
  const paidAt = new Date();

  order.status = "finalized";
  order.subtotal = totals.subtotal;
  order.discount = totals.discount;
  order.total = totals.total;
  order.payment = {
    method: paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paidAt,
    processedBy: attendant,
    simulated: true,
  };
  order.finalizedBy = attendant;
  order.updatedBy = attendant;

  pushHistory(order, "finalized", attendant, {
    paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
  });

  await order.save();
  await recordAudit("order.finalized", attendant, order, {
    paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    simulated: true,
  });

  return order;
}

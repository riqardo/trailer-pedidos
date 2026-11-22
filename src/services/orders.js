import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Counter } from "../models/Counter.js";
import { AuditLog } from "../models/AuditLog.js";
import { getAddon } from "../data/addons.js";
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
const MAX_ADDON_QUANTITY = 10;
const MAX_NOTES_LENGTH = 160;

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
    return { type: "balcao", label: "Balcão", vehicle: null };
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

  if (value.type === "mesa") {
    return { type: "mesa", label, vehicle: null };
  }

  const vehicle = typeof value.vehicle === "string" ? value.vehicle.trim() : "";
  if (!vehicle) {
    throw validationError(
      "Informe o modelo, marca ou cor do veículo para pedidos em placa.",
    );
  }

  if (vehicle.length > 80) {
    throw validationError(
      "O modelo/marca/cor do veículo deve ter no máximo 80 caracteres.",
    );
  }

  return { type: "placa", label, vehicle };
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

function normalizeNotes(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw validationError("A observação do item deve ser um texto.");
  }

  const notes = value.trim();
  if (!notes) return null;
  if (notes.length > MAX_NOTES_LENGTH) {
    throw validationError(
      `A observação do item deve ter no máximo ${MAX_NOTES_LENGTH} caracteres.`,
    );
  }
  return notes;
}

function normalizeAddons(rawAddons, category) {
  if (rawAddons === undefined || rawAddons === null) return [];
  if (!Array.isArray(rawAddons)) {
    throw validationError("A lista de adicionais do item é inválida.");
  }
  if (rawAddons.length === 0) return [];

  if (category !== "lanche") {
    throw validationError(
      "Adicionais só podem ser incluídos em itens da categoria lanche.",
    );
  }

  const merged = new Map();
  for (const raw of rawAddons) {
    if (!raw || typeof raw !== "object") {
      throw validationError("Adicional inválido.");
    }

    const code = typeof raw.code === "string" ? raw.code.trim() : "";
    const addon = getAddon(code);
    if (!addon) {
      throw validationError(`Adicional desconhecido: "${code || "sem código"}".`);
    }

    const quantity = Number(raw.quantity ?? 1);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ADDON_QUANTITY
    ) {
      throw validationError(
        `A quantidade de cada adicional deve ser entre 1 e ${MAX_ADDON_QUANTITY}.`,
      );
    }

    const total = (merged.get(code)?.quantity ?? 0) + quantity;
    if (total > MAX_ADDON_QUANTITY) {
      throw validationError(
        `A quantidade máxima do adicional "${addon.name}" é ${MAX_ADDON_QUANTITY}.`,
      );
    }

    merged.set(code, { addon, quantity: total });
  }

  return [...merged.values()]
    .sort((first, second) => first.addon.sortOrder - second.addon.sortOrder)
    .map(({ addon, quantity }) => ({
      code: addon.code,
      name: addon.name,
      unitPrice: addon.price,
      quantity,
      lineTotal: fromCents(toCents(addon.price) * quantity),
    }));
}

function computeLineTotal(unitPrice, addons, quantity) {
  const addonsCents = (addons ?? []).reduce(
    (sum, addon) => sum + toCents(addon.unitPrice) * addon.quantity,
    0,
  );
  return fromCents((toCents(unitPrice) + addonsCents) * quantity);
}

function itemSignature(item) {
  const addons = [...(item.addons ?? [])]
    .map((addon) => `${addon.code}:${addon.quantity}`)
    .sort()
    .join(",");

  return `${String(item.productId)}|${item.notes ?? ""}|${addons}`;
}

async function buildItems(rawItems, existingItems = []) {
  if (!Array.isArray(rawItems)) {
    throw validationError("A lista de itens é obrigatória.");
  }

  const prepared = [];
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      throw validationError("Item inválido na lista de itens.");
    }
    if (!mongoose.isValidObjectId(rawItem.productId)) {
      throw validationError("Identificador de produto inválido.");
    }

    prepared.push({
      productId: String(rawItem.productId),
      quantity: normalizeQuantity(rawItem.quantity),
      notes: normalizeNotes(rawItem.notes) ?? null,
      rawAddons: rawItem.addons,
    });
  }

  if (prepared.length === 0) return [];

  const productIds = [...new Set(prepared.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const existingByProduct = new Map();
  const existingBySignature = new Map();
  for (const item of existingItems) {
    const productId = String(item.productId);
    if (!existingByProduct.has(productId)) {
      existingByProduct.set(productId, item);
    }
    existingBySignature.set(itemSignature(item), item);
  }

  const merged = new Map();

  for (const entry of prepared) {
    const product = productsById.get(entry.productId);
    if (!product) {
      throw notFound(`Produto ${entry.productId} não encontrado.`);
    }

    const existing = existingByProduct.get(entry.productId);
    if (!product.available && !existing) {
      throw conflict(
        "PRODUCT_UNAVAILABLE",
        `O produto "${product.name}" está indisponível e não pode ser adicionado.`,
        { productId: entry.productId, productName: product.name },
      );
    }

    const unitPrice = product.available ? product.price : existing.unitPrice;
    const name = product.available ? product.name : existing.name;
    const category = product.available ? product.category : existing.category;
    const addons = normalizeAddons(entry.rawAddons, category);
    const signature = itemSignature({
      productId: entry.productId,
      notes: entry.notes,
      addons,
    });

    const current = merged.get(signature);
    const existingMatch = existingBySignature.get(signature);
    const quantity = (current?.quantity ?? 0) + entry.quantity;

    if (quantity > MAX_QUANTITY) {
      throw validationError(
        `A quantidade máxima por item é ${MAX_QUANTITY}.`,
      );
    }

    const item = {
      productId: product._id,
      name,
      category,
      unitPrice,
      quantity,
      notes: entry.notes,
      addons,
      lineTotal: computeLineTotal(unitPrice, addons, quantity),
    };

    const preservedId = current?._id ?? existingMatch?._id;
    if (preservedId) item._id = preservedId;

    merged.set(signature, item);
  }

  return [...merged.values()];
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
      { "location.vehicle": regex },
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
      location.label !== order.location.label ||
      (location.vehicle ?? null) !== (order.location.vehicle ?? null)
    ) {
      changes.location = {
        from: {
          type: order.location.type,
          label: order.location.label,
          vehicle: order.location.vehicle ?? null,
        },
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

  const [line] = await buildItems([payload], order.items);
  if (!line) {
    throw validationError("Item inválido.");
  }

  const attendant = attendantFromUser(user);
  const signature = itemSignature(line);
  const existing = order.items.find(
    (item) => itemSignature(item) === signature,
  );
  const addonsDetails = line.addons.map((addon) => ({
    code: addon.code,
    name: addon.name,
    quantity: addon.quantity,
  }));

  if (existing) {
    if (existing.quantity + line.quantity > MAX_QUANTITY) {
      throw validationError(
        `A quantidade máxima por item é ${MAX_QUANTITY}.`,
      );
    }

    const before = existing.quantity;
    existing.quantity += line.quantity;
    existing.lineTotal = computeLineTotal(
      existing.unitPrice,
      existing.addons,
      existing.quantity,
    );

    pushHistory(order, "item_added", attendant, {
      productId: String(line.productId),
      productName: existing.name,
      quantityAdded: line.quantity,
      quantityBefore: before,
      quantityAfter: existing.quantity,
      notes: existing.notes ?? null,
      addons: addonsDetails,
    });
  } else {
    order.items.push(line);
    pushHistory(order, "item_added", attendant, {
      productId: String(line.productId),
      productName: line.name,
      quantityAdded: line.quantity,
      quantityBefore: 0,
      quantityAfter: line.quantity,
      notes: line.notes,
      addons: addonsDetails,
    });
  }

  order.updatedBy = attendant;
  applyTotals(order);

  await order.save();
  await recordAudit("order.item_added", attendant, order, {
    productId: String(line.productId),
    productName: line.name,
    quantity: line.quantity,
    notes: line.notes,
    addons: addonsDetails,
  });

  return order;
}

export async function updateOrderItem(orderId, itemId, payload, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  if (!mongoose.isValidObjectId(itemId)) {
    throw notFound("Item não encontrado neste pedido.");
  }

  const item = order.items.find(
    (current) => String(current._id) === String(itemId),
  );

  if (!item) {
    throw notFound("Item não encontrado neste pedido.");
  }

  const hasField = (field) =>
    Object.prototype.hasOwnProperty.call(payload ?? {}, field);

  if (!hasField("quantity") && !hasField("notes") && !hasField("addons")) {
    throw validationError(
      "Informe ao menos um campo do item: quantity, notes ou addons.",
    );
  }

  const attendant = attendantFromUser(user);
  const before = {
    quantity: item.quantity,
    notes: item.notes ?? null,
    addons: item.addons.map((addon) => ({
      code: addon.code,
      quantity: addon.quantity,
    })),
  };

  if (hasField("quantity")) {
    item.quantity = normalizeQuantity(payload.quantity);
  }
  if (hasField("notes")) {
    item.notes = normalizeNotes(payload.notes) ?? null;
  }
  if (hasField("addons")) {
    item.addons = normalizeAddons(payload.addons, item.category);
  }

  item.lineTotal = computeLineTotal(item.unitPrice, item.addons, item.quantity);

  order.updatedBy = attendant;
  applyTotals(order);

  const details = {
    productId: String(item.productId),
    productName: item.name,
    quantityBefore: before.quantity,
    quantityAfter: item.quantity,
    notesBefore: before.notes,
    notesAfter: item.notes ?? null,
    addonsBefore: before.addons,
    addonsAfter: item.addons.map((addon) => ({
      code: addon.code,
      quantity: addon.quantity,
    })),
  };
  pushHistory(order, "item_updated", attendant, details);

  await order.save();
  await recordAudit("order.item_updated", attendant, order, details);

  return order;
}

export async function removeOrderItem(orderId, itemId, user) {
  const order = await findOrderOrThrow(orderId);
  ensureOpen(order);

  if (!mongoose.isValidObjectId(itemId)) {
    throw notFound("Item não encontrado neste pedido.");
  }

  const itemIndex = order.items.findIndex(
    (current) => String(current._id) === String(itemId),
  );

  if (itemIndex === -1) {
    throw notFound("Item não encontrado neste pedido.");
  }

  const [removed] = order.items.splice(itemIndex, 1);
  const attendant = attendantFromUser(user);

  order.updatedBy = attendant;
  applyTotals(order);
  pushHistory(order, "item_removed", attendant, {
    productId: String(removed.productId),
    productName: removed.name,
    quantity: removed.quantity,
    notes: removed.notes ?? null,
    addons: removed.addons.map((addon) => ({
      code: addon.code,
      name: addon.name,
      quantity: addon.quantity,
    })),
  });

  await order.save();
  await recordAudit("order.item_removed", attendant, order, {
    productId: String(removed.productId),
    productName: removed.name,
    quantity: removed.quantity,
    notes: removed.notes ?? null,
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

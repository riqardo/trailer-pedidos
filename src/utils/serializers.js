export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    available: product.available,
    icon: product.icon,
    sortOrder: product.sortOrder,
  };
}

export function serializeHistoryEntry(entry) {
  return {
    action: entry.action,
    attendant: entry.attendant,
    at: entry.at,
    details: entry.details ?? null,
  };
}

export function serializeOrder(order, { includeHistory = true } = {}) {
  const raw = order.toObject ? order.toObject() : order;

  return {
    id: String(raw._id),
    number: raw.number,
    code: `#${String(raw.number).padStart(4, "0")}`,
    customerName: raw.customerName,
    location: raw.location,
    status: raw.status,
    items: raw.items.map((item) => ({
      id: item._id ? String(item._id) : null,
      productId: String(item.productId),
      name: item.name,
      category: item.category,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      notes: item.notes ?? null,
      addons: (item.addons ?? []).map((addon) => ({
        code: addon.code,
        name: addon.name,
        unitPrice: addon.unitPrice,
        quantity: addon.quantity,
        lineTotal: addon.lineTotal,
      })),
      lineTotal: item.lineTotal,
    })),
    subtotal: raw.subtotal,
    discount: raw.discount,
    total: raw.total,
    payment: raw.payment
      ? {
          method: raw.payment.method,
          subtotal: raw.payment.subtotal,
          discount: raw.payment.discount,
          total: raw.payment.total,
          paidAt: raw.payment.paidAt,
          processedBy: raw.payment.processedBy,
          simulated: raw.payment.simulated,
        }
      : null,
    itemCount: raw.items.reduce((sum, item) => sum + item.quantity, 0),
    createdBy: raw.createdBy,
    updatedBy: raw.updatedBy,
    finalizedBy: raw.finalizedBy ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    history: includeHistory
      ? [...(raw.history ?? [])].reverse().map(serializeHistoryEntry)
      : undefined,
  };
}

export const CASH_DISCOUNT_PERCENT = 10;

export function toCents(value) {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

export function calculateTotals(items, paymentMethod = null) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + toCents(item.lineTotal),
    0,
  );

  const discountCents =
    paymentMethod === "dinheiro"
      ? Math.round((subtotalCents * CASH_DISCOUNT_PERCENT) / 100)
      : 0;

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    total: fromCents(subtotalCents - discountCents),
  };
}

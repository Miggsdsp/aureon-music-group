export type MerchInventoryProduct = {
  stock?: number;
  sizeStock?: Record<string, number>;
  sizes?: string[];
  available?: boolean;
};

export function normaliseSizes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export function normaliseColours(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export function normaliseSizeStock(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, qty]) => [key, Math.max(0, Math.floor(Number(qty) || 0))]));
}

export function availableQuantity(product: MerchInventoryProduct, size?: string) {
  if (product.available === false) return 0;
  const sizeStock = normaliseSizeStock(product.sizeStock);
  const sizeKeys = Object.keys(sizeStock);
  if (size && sizeKeys.length) return Math.max(0, Number(sizeStock[size] || 0));
  if (sizeKeys.length) return Object.values(sizeStock).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  if (product.stock === undefined || product.stock === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(Number(product.stock) || 0));
}

export function isSoldOut(product: MerchInventoryProduct) {
  return availableQuantity(product) <= 0;
}

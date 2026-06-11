import type { IProduct } from '@/models/Product';

export interface CatalogProductInput {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  externalUrl?: string;
}

/**
 * Formats Mongo catalog products as a site section for static export (retail lite).
 */
export function buildProductsSection(products: CatalogProductInput[]) {
  const published = products.filter((p) => p.name);
  if (published.length === 0) return null;

  return {
    type: 'services' as const,
    title: 'Our Products',
    subtitle: 'Browse our catalog — contact us to purchase.',
    body: 'Product listings from your Auvira.ai catalog.',
    items: published.map((p) => ({
      title: p.price != null ? `${p.name} — ${formatPrice(p.price, p.currency)}` : p.name,
      description: p.description || (p.externalUrl ? `Learn more: ${p.externalUrl}` : undefined),
    })),
  };
}

function formatPrice(price: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function productsToCatalogInput(products: Pick<IProduct, 'name' | 'description' | 'price' | 'currency' | 'externalUrl'>[]): CatalogProductInput[] {
  return products.map((p) => ({
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    externalUrl: p.externalUrl,
  }));
}

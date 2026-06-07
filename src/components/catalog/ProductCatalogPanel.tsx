'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { cn } from '@/lib/cn';
import { BORDER, TEXT } from '@/content/productTheme';

interface ProductRow {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  externalUrl?: string;
}

interface Props {
  projectId: string;
}

/** Phase 2 product catalog admin — static product grid on published site. */
export function ProductCatalogPanel({ projectId }: Props) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/catalog`);
      const data = await res.json();
      if (data.ok) setProducts(data.products);
      else setError(data.error || 'Failed to load products');
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          price: price ? Number(price) : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setName('');
        setDescription('');
        setPrice('');
        await load();
      } else {
        setError(data.error || 'Failed to add product');
      }
    } catch {
      setError('Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/catalog/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMessage('Products added to your draft. Publish live to update your site.');
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loading size="md" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className={cn('text-sm font-semibold', TEXT.primary)}>Product catalog</h3>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>
          Add products to show on your site. Online checkout (Stripe) comes in a later phase.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <div className="space-y-2">
          <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="Price (optional, e.g. 29.99)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button className="w-full" onClick={handleAdd} disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add product'}
          </Button>
        </div>

        {products.length > 0 && (
          <ul className="space-y-2 text-sm">
            {products.map((p) => (
              <li key={p.id} className={cn('border rounded-lg p-2', BORDER.hairline)}>
                <p className={cn('font-medium', TEXT.primary)}>{p.name}</p>
                {p.description && <p className={cn('text-xs', TEXT.muted)}>{p.description}</p>}
                {p.price != null && (
                  <p className={cn('text-xs mt-0.5', TEXT.muted)}>${p.price.toFixed(2)}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" className="w-full" onClick={handleSync} disabled={syncing || products.length === 0}>
          {syncing ? 'Updating draft…' : 'Add products to draft preview'}
        </Button>
      </CardBody>
    </Card>
  );
}

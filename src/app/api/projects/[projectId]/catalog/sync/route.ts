import { NextResponse } from 'next/server';
import { getOwnerProject, requireAuth } from '@/lib/api/projectAccess';
import { productsToCatalogInput } from '@/lib/catalog/buildProductsSection';
import { syncCatalogToWorkspace } from '@/lib/catalog/syncCatalogToWorkspace';
import { connectMongoDB } from '@/lib/mongodb';
import { Product } from '@/models/Product';
import { WebsiteProject } from '@/models/WebsiteProject';

/** Sync Mongo catalog into draft siteConfig for static product grid. */
export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  await connectMongoDB();
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const products = await Product.find({ projectId: project._id, status: 'published' }).lean();
  const applied = await syncCatalogToWorkspace(
    params.projectId,
    productsToCatalogInput(
      products.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        externalUrl: p.externalUrl,
      }))
    )
  );

  if (applied.updated) {
    await WebsiteProject.updateOne(
      { _id: project._id },
      { $set: { hasUnpublishedChanges: true, needsSave: true } }
    );
  }

  return NextResponse.json({
    ok: true,
    updated: applied.updated,
    productCount: products.length,
  });
}

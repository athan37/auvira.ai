import { NextResponse } from 'next/server';
import { getOwnerProject, requireAuth } from '@/lib/api/projectAccess';
import { connectMongoDB } from '@/lib/mongodb';
import { Product } from '@/models/Product';
import mongoose from 'mongoose';

/** List products for a project catalog (Phase 2). */
export async function GET(
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

  const products = await Product.find({ projectId: project._id })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  return NextResponse.json({
    ok: true,
    products: products.map((p) => ({
      id: (p._id as mongoose.Types.ObjectId).toString(),
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      category: p.category,
      imageUrl: p.imageUrl,
      externalUrl: p.externalUrl,
      status: p.status,
      sortOrder: p.sortOrder,
    })),
  });
}

/** Create a catalog product. */
export async function POST(
  request: Request,
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

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  const product = await Product.create({
    projectId: project._id,
    ownerId: new mongoose.Types.ObjectId(authResult.userId),
    name: body.name,
    description: body.description,
    price: body.price,
    currency: body.currency || 'USD',
    category: body.category,
    imageUrl: body.imageUrl,
    externalUrl: body.externalUrl,
    status: body.status || 'published',
    sortOrder: body.sortOrder ?? 0,
  });

  return NextResponse.json({
    ok: true,
    product: { id: product._id.toString(), name: product.name },
  });
}

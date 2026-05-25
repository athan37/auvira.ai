import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price?: number;
  currency: string;
  category?: string;
  imageUrl?: string;
  externalUrl?: string;
  status: 'draft' | 'published';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number },
    currency: { type: String, default: 'USD' },
    category: { type: String },
    imageUrl: { type: String },
    externalUrl: { type: String },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

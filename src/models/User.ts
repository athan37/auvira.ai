import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  image?: string;
  authProvider: 'google' | 'email';
  authProviderId: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    image: { type: String },
    authProvider: { type: String, enum: ['google', 'email'], default: 'google' },
    authProviderId: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
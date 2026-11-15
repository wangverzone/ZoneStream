import mongoose, { Schema, Document } from 'mongoose';

export interface IFriendship {
  pairKey: string;
  requesterUid: string;
  recipientUid: string;
  status: 'pending' | 'accepted';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFriendshipDocument extends IFriendship, Document {}

const FriendshipSchema = new Schema<IFriendshipDocument>(
  {
    pairKey: { type: String, required: true, unique: true, index: true },
    requesterUid: { type: String, required: true, index: true },
    recipientUid: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending', index: true },
  },
  { timestamps: true }
);

export const FriendshipModel =
  (mongoose.models.Friendship as mongoose.Model<IFriendshipDocument>) ||
  mongoose.model<IFriendshipDocument>('Friendship', FriendshipSchema);

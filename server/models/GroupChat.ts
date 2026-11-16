import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupChat {
  groupId: string;
  name: string;
  description: string;
  avatarUrl: string;
  creatorUid: string;
  members: string[];
  pendingMembers: string[];
  createdAt?: Date;
}

export interface IGroupChatDocument extends IGroupChat, Document {}

const GroupChatSchema = new Schema<IGroupChatDocument>(
  {
    groupId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    creatorUid: { type: String, required: true },
    members: { type: [String], default: [] },
    pendingMembers: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const GroupChatModel =
  (mongoose.models.GroupChat as mongoose.Model<IGroupChatDocument>) ||
  mongoose.model<IGroupChatDocument>('GroupChat', GroupChatSchema);

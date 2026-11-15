import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupMessage {
  groupId: string;
  senderUid: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | '';
  sticker?: string;
  replyToId?: string;
  replySenderName?: string;
  replyText?: string;
  createdAt?: Date;
}

export interface IGroupMessageDocument extends IGroupMessage, Document {}

const GroupMessageSchema = new Schema<IGroupMessageDocument>(
  {
    groupId: { type: String, required: true, index: true },
    senderUid: { type: String, required: true },
    senderName: { type: String, required: true },
    senderPhoto: { type: String, default: '' },
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, default: '' },
    sticker: { type: String, default: '' },
    replyToId: { type: String, default: '' },
    replySenderName: { type: String, default: '' },
    replyText: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GroupMessageSchema.index({ groupId: 1, createdAt: 1 });

export const GroupMessageModel =
  (mongoose.models.GroupMessage as mongoose.Model<IGroupMessageDocument>) ||
  mongoose.model<IGroupMessageDocument>('GroupMessage', GroupMessageSchema);

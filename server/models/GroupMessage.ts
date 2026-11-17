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
  replySenderUid?: string;
  replySenderName?: string;
  replySenderIsVerified?: boolean;
  replyText?: string;
  reactions?: Record<string, string[]>;
  editedAt?: Date | string | null;
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
    replySenderUid: { type: String, default: '' },
    replySenderName: { type: String, default: '' },
    replySenderIsVerified: { type: Boolean, default: false },
    replyText: { type: String, default: '' },
    reactions: { type: Schema.Types.Mixed, default: {} },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GroupMessageSchema.index({ groupId: 1, createdAt: 1 });

export const GroupMessageModel =
  (mongoose.models.GroupMessage as mongoose.Model<IGroupMessageDocument>) ||
  mongoose.model<IGroupMessageDocument>('GroupMessage', GroupMessageSchema);

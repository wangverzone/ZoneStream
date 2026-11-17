import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  sticker?: string;
  replyToId?: string;
  replySenderName?: string;
  replyText?: string;
  reactions?: Record<string, string[]>;
  editedAt?: Date | string | null;
  readAt?: Date | null;
  createdAt?: Date;
}

export interface IChatMessageDocument extends IChatMessage, Document {}

const ChatMessageSchema = new Schema<IChatMessageDocument>(
  {
    conversationId: { type: String, required: true, index: true },
    senderUid: { type: String, required: true, index: true },
    recipientUid: { type: String, required: true, index: true },
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, default: '' },
    sticker: { type: String, default: '' },
    replyToId: { type: String, default: '' },
    replySenderName: { type: String, default: '' },
    replyText: { type: String, default: '' },
    reactions: { type: Schema.Types.Mixed, default: {} },
    editedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const ChatMessageModel =
  (mongoose.models.ChatMessage as mongoose.Model<IChatMessageDocument>) ||
  mongoose.model<IChatMessageDocument>('ChatMessage', ChatMessageSchema);

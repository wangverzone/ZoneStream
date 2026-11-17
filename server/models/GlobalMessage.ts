import mongoose, { Schema, Document } from 'mongoose';

export interface IGlobalMessage {
  channel?: string;
  senderUid: string;
  senderName: string;
  senderPhoto?: string;
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
  createdAt?: Date | string;
}

export interface IGlobalMessageDocument extends IGlobalMessage, Document {}

const GlobalMessageSchema = new Schema<IGlobalMessageDocument>(
  {
    channel: { type: String, default: 'ch1', index: true },
    senderUid: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    senderPhoto: { type: String, default: '' },
    text: { type: String, default: '', trim: true, maxlength: 1500 },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'audio', ''], default: '' },
    sticker: { type: String, default: '' },
    replyToId: { type: String, default: '' },
    replySenderUid: { type: String, default: '' },
    replySenderName: { type: String, default: '' },
    replySenderIsVerified: { type: Boolean, default: false },
    replyText: { type: String, default: '' },
    reactions: { type: Schema.Types.Mixed, default: {} },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const GlobalMessageModel =
  (mongoose.models.GlobalMessage as mongoose.Model<IGlobalMessageDocument>) ||
  mongoose.model<IGlobalMessageDocument>('GlobalMessage', GlobalMessageSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IComment {
  mediaKey: string;
  mediaTitle: string;
  episodeTitle?: string;
  parentId?: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  authorRole: 'member' | 'founder';
  authorIsPremium: boolean;
  authorBadge: string;
  authorBorder: string;
  authorTheme?: string;
  authorStatusEmoji?: string;
  authorLevel: number;
  text: string;
  sticker?: string;
  likes: string[];
  pinned: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICommentDocument extends IComment, Document {}

const CommentSchema = new Schema<ICommentDocument>(
  {
    mediaKey: { type: String, required: true, index: true },
    mediaTitle: { type: String, default: '' },
    episodeTitle: { type: String, default: '' },
    parentId: { type: String, default: '', index: true },
    uid: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    authorPhoto: { type: String, default: '' },
    authorRole: { type: String, enum: ['member', 'founder'], default: 'member' },
    authorIsPremium: { type: Boolean, default: false },
    authorBadge: { type: String, default: 'Member' },
    authorBorder: { type: String, default: 'classic' },
    authorTheme: { type: String, default: 'default' },
    authorStatusEmoji: { type: String, default: '' },
    authorLevel: { type: Number, default: 1 },
    text: { type: String, default: '', maxlength: 800 },
    sticker: { type: String, default: '' },
    likes: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CommentModel =
  (mongoose.models.Comment as mongoose.Model<ICommentDocument>) ||
  mongoose.model<ICommentDocument>('Comment', CommentSchema);

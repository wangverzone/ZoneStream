import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'favorite_episode'
  | 'comment_reply'
  | 'comment_like'
  | 'friend_request'
  | 'friend_accept'
  | 'clan_review'
  | 'system';

export interface INotification {
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  poster?: string;
  actorUid?: string;
  actorName?: string;
  actorPhoto?: string;
  dedupeKey?: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    uid: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'favorite_episode',
        'comment_reply',
        'comment_like',
        'friend_request',
        'friend_accept',
        'clan_review',
        'system',
      ],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true, maxlength: 140 },
    message: { type: String, required: true, maxlength: 360 },
    link: { type: String, default: '/' },
    poster: { type: String, default: '' },
    actorUid: { type: String, default: '' },
    actorName: { type: String, default: '' },
    actorPhoto: { type: String, default: '' },
    dedupeKey: { type: String, default: '', index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ uid: 1, createdAt: -1 });
NotificationSchema.index({ uid: 1, dedupeKey: 1 });

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<INotificationDocument>) ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface WatchHistoryItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  episodeId: string;
  episodeTitle: string;
  episodeNumber: string;
  progress: number;
  updatedAt: string;
}

export interface BookmarkItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  rating: string;
  status: string;
  addedAt: string;
}

export interface IUser {
  uid: string;
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  bio?: string;
  role: 'member' | 'founder';
  photoUrl: string;
  bannerUrl: string;
  level: number;
  exp: number;
  isPremium: boolean;
  isVerified: boolean;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  activeBadge: string;
  activeBorder: string;
  profileTheme: string;
  statusEmoji: string;
  countryCode?: string;
  lastWatchDate?: string;
  watchStreak?: number;
  dailyEpisodesWatched?: number;
  totalEpisodesWatched?: number;
  watchHistory: WatchHistoryItem[];
  bookmarks: BookmarkItem[];
  episodeBookmarks: EpisodeBookmarkItem[];
  lastActiveAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PublicUser = Omit<IUser, 'passwordHash'>;

export interface IUserDocument extends IUser, Document {}

const WatchHistorySchema = new Schema<WatchHistoryItem>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['anime', 'donghua'], required: true },
    title: { type: String, required: true },
    poster: { type: String, default: '' },
    episodeId: { type: String, required: true },
    episodeTitle: { type: String, required: true },
    episodeNumber: { type: String, default: '1' },
    progress: { type: Number, default: 15, min: 0, max: 100 },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const BookmarkSchema = new Schema<BookmarkItem>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['anime', 'donghua'], required: true },
    title: { type: String, required: true },
    poster: { type: String, default: '' },
    rating: { type: String, default: '8.0' },
    status: { type: String, default: 'Ongoing' },
    addedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

export interface EpisodeBookmarkItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  episodeId: string;
  episodeTitle: string;
  episodeNumber: string;
  addedAt: string;
}

const EpisodeBookmarkSchema = new Schema<EpisodeBookmarkItem>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['anime', 'donghua'], required: true },
    title: { type: String, required: true },
    poster: { type: String, default: '' },
    episodeId: { type: String, required: true },
    episodeTitle: { type: String, required: true },
    episodeNumber: { type: String, default: '1' },
    addedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    bio: { type: String, default: '' },
    role: { type: String, enum: ['member', 'founder'], default: 'member' },
    photoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    level: { type: Number, default: 1, min: 1 },
    exp: { type: Number, default: 0, min: 0 },
    isPremium: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    premiumPlan: { type: String, default: '' },
    premiumExpiryDate: { type: String, default: '' },
    activeBadge: { type: String, default: 'Member' },
    activeBorder: { type: String, default: 'classic' },
    profileTheme: { type: String, default: 'default' },
    statusEmoji: { type: String, default: '' },
    countryCode: { type: String, default: 'ID' },
    lastWatchDate: { type: String, default: '' },
    watchStreak: { type: Number, default: 0, min: 0 },
    dailyEpisodesWatched: { type: Number, default: 0, min: 0 },
    totalEpisodesWatched: { type: Number, default: 0, min: 0 },
    watchHistory: { type: [WatchHistorySchema], default: [] },
    bookmarks: { type: [BookmarkSchema], default: [] },
    episodeBookmarks: { type: [EpisodeBookmarkSchema], default: [] },
    lastActiveAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const UserModel =
  (mongoose.models.User as mongoose.Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', UserSchema);

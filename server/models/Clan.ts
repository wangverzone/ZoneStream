import mongoose, { Schema, Document } from 'mongoose';

export interface IClan {
  clanId: string;
  name: string;
  tag: string;
  description: string;
  avatarUrl: string;
  leaderUid: string;
  leaderName: string;
  level: number;
  members: string[];
  maxMembers: number;
  status: 'Terbuka' | 'Persetujuan' | 'Undangan' | 'Penuh';
  createdAt?: string;
}

export interface IClanDocument extends IClan, Document {}

const ClanSchema = new Schema<IClanDocument>(
  {
    clanId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    tag: { type: String, required: true, uppercase: true },
    description: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    leaderUid: { type: String, required: true },
    leaderName: { type: String, required: true },
    level: { type: Number, default: 1 },
    members: { type: [String], default: [] },
    maxMembers: { type: Number, default: 50 },
    status: { type: String, enum: ['Terbuka', 'Persetujuan', 'Undangan', 'Penuh'], default: 'Terbuka' },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const ClanModel =
  (mongoose.models.Clan as mongoose.Model<IClanDocument>) ||
  mongoose.model<IClanDocument>('Clan', ClanSchema);

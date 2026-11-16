import mongoose, { Schema, Document } from 'mongoose';

export type ClanActivityType =
  | 'level_up'
  | 'mission_complete'
  | 'member_join'
  | 'role_change'
  | 'member_kick';

export interface IClanActivity {
  clanId: string;
  actorUid: string;
  actorName: string;
  actorPhoto?: string;
  type: ClanActivityType;
  title: string;
  detail: string;
  expGained?: number;
  newLevel?: number;
  streakDay?: number;
  createdAt?: Date | string;
}

export interface IClanActivityDocument extends Omit<IClanActivity, 'createdAt'>, Document {
  createdAt: Date;
}

const ClanActivitySchema = new Schema<IClanActivityDocument>(
  {
    clanId: { type: String, required: true, index: true },
    actorUid: { type: String, required: true, index: true },
    actorName: { type: String, required: true, maxlength: 80 },
    actorPhoto: { type: String, default: '' },
    type: {
      type: String,
      enum: ['level_up', 'mission_complete', 'member_join', 'role_change', 'member_kick'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 140 },
    detail: { type: String, default: '', maxlength: 280 },
    expGained: { type: Number, default: 0 },
    newLevel: { type: Number, default: 0 },
    streakDay: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClanActivitySchema.index({ clanId: 1, createdAt: -1 });

export const ClanActivityModel =
  (mongoose.models.ClanActivity as mongoose.Model<IClanActivityDocument>) ||
  mongoose.model<IClanActivityDocument>('ClanActivity', ClanActivitySchema);

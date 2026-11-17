import mongoose, { Schema, Document } from 'mongoose';

export type CoinTxType =
  | 'daily_checkin'
  | 'level_up'
  | 'milestone_bonus'
  | 'gift_sent'
  | 'gift_received'
  | 'self_redeem'
  | 'refund';

export interface ICoinTransaction {
  txId: string;
  uid: string;
  type: CoinTxType;
  amount: number;
  balanceAfter: number;
  peerUid?: string;
  peerName?: string;
  peerUsername?: string;
  packageId?: string;
  durationDays?: number;
  note: string;
  requestId?: string;
  createdAt?: Date | string;
}

export interface ICoinTransactionDocument extends ICoinTransaction, Document {}

const CoinTransactionSchema = new Schema<ICoinTransactionDocument>(
  {
    txId: { type: String, required: true, unique: true, index: true },
    uid: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'daily_checkin',
        'level_up',
        'milestone_bonus',
        'gift_sent',
        'gift_received',
        'self_redeem',
        'refund',
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    peerUid: { type: String, default: '' },
    peerName: { type: String, default: '' },
    peerUsername: { type: String, default: '' },
    packageId: { type: String, default: '' },
    durationDays: { type: Number, default: 0 },
    note: { type: String, required: true, maxlength: 260 },
    requestId: { type: String, default: '', index: true },
  },
  { timestamps: true }
);

CoinTransactionSchema.index({ uid: 1, createdAt: -1 });
CoinTransactionSchema.index({ uid: 1, requestId: 1 });

export const CoinTransactionModel =
  (mongoose.models.CoinTransaction as mongoose.Model<ICoinTransactionDocument>) ||
  mongoose.model<ICoinTransactionDocument>('CoinTransaction', CoinTransactionSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction {
  orderId: string;
  txnId?: string;
  uid: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  durationDays: number;
  bonusExp: number;
  amount: number;
  fee: number;
  totalPayment: number;
  paymentMethod: string;
  paymentNumber: string;
  paymentUrl: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  verificationStage?: 'awaiting_payment' | 'verifying_proof' | 'verified' | 'rejected';
  verificationMethod?: 'pakasir_webhook' | 'pakasir_polling' | 'transfer_proof_auto';
  proofImageUrl?: string;
  proofStoragePath?: string;
  proofSenderRef?: string;
  proofHash?: string;
  proofSubmittedAt?: string;
  expiredAt?: string;
  paidAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransactionDocument extends ITransaction, Document {}

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    txnId: { type: String, default: '' },
    uid: { type: String, required: true, index: true },
    userEmail: { type: String, default: '' },
    userName: { type: String, default: '' },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    durationDays: { type: Number, required: true },
    bonusExp: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    totalPayment: { type: Number, required: true },
    paymentMethod: { type: String, default: 'qris' },
    paymentNumber: { type: String, default: '' },
    paymentUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'failed'],
      default: 'pending',
    },
    verificationStage: {
      type: String,
      enum: ['awaiting_payment', 'verifying_proof', 'verified', 'rejected'],
      default: 'awaiting_payment',
    },
    verificationMethod: {
      type: String,
      enum: ['pakasir_webhook', 'pakasir_polling', 'transfer_proof_auto'],
      default: 'pakasir_polling',
    },
    proofImageUrl: { type: String, default: '' },
    proofStoragePath: { type: String, default: '' },
    proofSenderRef: { type: String, default: '' },
    proofHash: { type: String, default: '', index: true },
    proofSubmittedAt: { type: String, default: '' },
    expiredAt: { type: String, default: '' },
    paidAt: { type: String, default: '' },
  },
  { timestamps: true }
);

export const TransactionModel =
  (mongoose.models.Transaction as mongoose.Model<ITransactionDocument>) ||
  mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

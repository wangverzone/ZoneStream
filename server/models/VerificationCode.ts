import mongoose, { Schema, Document } from 'mongoose';

export type OtpPurpose = 'register' | 'change-email' | 'change-password' | 'forgot-password';

export interface IVerificationCode {
  email: string;
  uid?: string;
  purpose: OtpPurpose;
  code: string;
  expiresAt: Date;
}

export interface IVerificationCodeDocument extends IVerificationCode, Document {}

const VerificationCodeSchema = new Schema<IVerificationCodeDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    uid: { type: String, default: '' },
    purpose: {
      type: String,
      enum: ['register', 'change-email', 'change-password', 'forgot-password'],
      required: true,
    },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const VerificationCodeModel =
  (mongoose.models.VerificationCode as mongoose.Model<IVerificationCodeDocument>) ||
  mongoose.model<IVerificationCodeDocument>('VerificationCode', VerificationCodeSchema);

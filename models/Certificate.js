import mongoose from 'mongoose';

const CertificateSchema = new mongoose.Schema({
  userName: String,
  courseTitle: String,
  score: Number,
  certId: { type: String, unique: true },
  issueDate: { type: Date, default: Date.now },
  verificationUrl: String,
});

export default mongoose.model("Certificate", CertificateSchema);

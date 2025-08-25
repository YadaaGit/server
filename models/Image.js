import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  contentType: { type: String, required: true }, // e.g. "image/png"
  data: { type: Buffer, required: true },        // <-- binary data
  createdAt: { type: Date, default: Date.now }
});

export default imageSchema;
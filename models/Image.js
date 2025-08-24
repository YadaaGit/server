import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  uid: String,
  for: String,
  title: String,
  coverImage: Buffer,
});

// Export the schema
export default imageSchema;

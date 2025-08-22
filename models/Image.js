import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  image_id: String,
  for: String,
  title: String,
  coverImage: Buffer,
});

// Export the schema
export default imageSchema;

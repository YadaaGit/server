import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
  uid: String,
  title: String,
  module_index: Number,
  content: Array,
  quiz: Array,
  metadata: Object,
});

// Export the schema
export default moduleSchema;

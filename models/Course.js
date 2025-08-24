import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  uid: String,
  title: String,
  description: String,
  course_index: Number,
  module_ids: Object,
  metadata: Object,
});

// Export the schema
export default courseSchema;


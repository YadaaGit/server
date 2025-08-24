import mongoose from "mongoose";

const finalQuizSchema = new mongoose.Schema({
  uid: String,
  quiz_title: String,
  quiz_description: String,
  title: String,
  questions: Array,
  metadata: Object,
});

// Export the schema
export default finalQuizSchema;

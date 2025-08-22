import express from "express";
import mongoose from "mongoose";
import programSchema from "../models/Program.js";
import courseSchema from "../models/Course.js";
import moduleSchema from "../models/Module.js";
import finalQuizSchema from "../models/FinalQuiz.js";
import imageSchema from "../models/Image.js";

const router = express.Router();

// Register models (to avoid overwrite issues in hot reloads)
const Program = mongoose.models.Program || mongoose.model("Program", programSchema);
const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);
const Module = mongoose.models.Module || mongoose.model("Module", moduleSchema);
const FinalQuiz = mongoose.models.FinalQuiz || mongoose.model("FinalQuiz", finalQuizSchema);
const Image = mongoose.models.Image || mongoose.model("Image", imageSchema);

/**
 * GET /api/:lang/programs/:programId
 * Assembles one full program object with courses, modules, quizzes, images
 */
router.get("/:lang/programs/:programId", async (req, res) => {
  try {
    const { lang, programId } = req.params;

    // Validate lang prefix
    const dbName = `${lang}_courses`; // ex: "AM_courses"
    if (!["AM_courses", "OR_courses", "EN_courses"].includes(dbName)) {
      return res.status(400).json({ error: "Invalid language collection" });
    }

    // Switch DB (each language is a separate db connection)
    const db = mongoose.connection.useDb(dbName);

    const ProgramModel = db.model("Program", programSchema);
    const CourseModel = db.model("Course", courseSchema);
    const ModuleModel = db.model("Module", moduleSchema);
    const FinalQuizModel = db.model("FinalQuiz", finalQuizSchema);
    const ImageModel = db.model("Image", imageSchema);

    // 1. Fetch program
    const program = await ProgramModel.findOne({ program_id: programId }).lean();
    if (!program) return res.status(404).json({ error: "Program not found" });

    // 2. Fetch courses
    const courseIds = Object.values(program.courses_ids || {});
    const courses = await CourseModel.find({ course_id: { $in: courseIds } }).lean();

    // 3. Fetch modules for each course
    const assembledCourses = await Promise.all(
      courses.map(async (course) => {
        const moduleIds = Object.values(course.module_ids || {});
        const modules = await ModuleModel.find({ module_id: { $in: moduleIds } }).lean();

        return {
          ...course,
          modules, // attach all modules with content + quiz
        };
      })
    );

    // 4. Fetch final quiz
    const finalQuiz = program.final_quiz_id
      ? await FinalQuizModel.findOne({ quiz_id: program.final_quiz_id }).lean()
      : null;

    // 5. Fetch images (optional)
    const images = await ImageModel.find({}).lean();

    // 6. Assemble final shape
    const assembledProgram = {
      program_id: program.program_id,
      title: program.title,
      courses: assembledCourses,
      final_quiz: finalQuiz,
      metadata: program.metadata || {},
      images: images.map((img) => ({
        ...img,
        coverImage: img.coverImage?.toString("base64"), // convert Buffer → base64 string
      })),
    };

    res.json(assembledProgram);
  } catch (err) {
    console.error("❌ Error assembling program:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

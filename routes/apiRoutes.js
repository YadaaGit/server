// routes/apiRoutes.js
import express from "express";
import mongoose from "mongoose";

import programSchema from "../models/Program.js";
import courseSchema from "../models/Course.js";
import moduleSchema from "../models/Module.js";
import finalQuizSchema from "../models/FinalQuiz.js";
import imageSchema from "../models/Image.js";

const router = express.Router();

// Register fallback models globally (avoid overwrite issues in dev)
mongoose.models.Program || mongoose.model("Program", programSchema);
mongoose.models.Course || mongoose.model("Course", courseSchema);
mongoose.models.Module || mongoose.model("Module", moduleSchema);
mongoose.models.FinalQuiz || mongoose.model("FinalQuiz", finalQuizSchema);
mongoose.models.Image || mongoose.model("Image", imageSchema);

/**
 * GET /api/:lang/programs/:programId
 * Fetches a full program object with nested courses, modules, quizzes, and images
 */
router.get("/:lang/programs/:programId", async (req, res) => {
  try {
    const { lang, programId } = req.params;

    // --- validate language ---
    const dbName = `${lang}_courses`; // e.g. "AM_courses"
    if (!["AM_courses", "OR_courses", "EN_courses"].includes(dbName)) {
      return res.status(400).json({ error: "Invalid language collection" });
    }

    // --- switch to correct DB ---
    const db = mongoose.connection.useDb(dbName);

    const ProgramModel = db.model("Program", programSchema);
    const CourseModel = db.model("Course", courseSchema);
    const ModuleModel = db.model("Module", moduleSchema);
    const FinalQuizModel = db.model("FinalQuiz", finalQuizSchema);
    const ImageModel = db.model("Image", imageSchema);

    // --- 1. fetch program ---
    const program = await ProgramModel.findOne({ program_id: programId }).lean();
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

    // --- 2. fetch courses ---
    const courseIds = Object.values(program.courses_ids || {});
    const courses = await CourseModel.find({ course_id: { $in: courseIds } }).lean();

    // --- 3. fetch modules for each course ---
    const assembledCourses = await Promise.all(
      courses.map(async (course) => {
        const moduleIds = Object.values(course.module_ids || {});
        const modules = await ModuleModel.find({ module_id: { $in: moduleIds } }).lean();
        return { ...course, modules };
      })
    );

    // --- 4. fetch final quiz (if any) ---
    const finalQuiz = program.final_quiz_id
      ? await FinalQuizModel.findOne({ quiz_id: program.final_quiz_id }).lean()
      : null;

    // --- 5. fetch images ---
    const images = await ImageModel.find({}).lean();
    const formattedImages = images.map((img) => ({
      ...img,
      coverImage: img.coverImage?.toString("base64") || null, // convert buffer
    }));

    // --- 6. assemble final object ---
    const assembledProgram = {
      program_id: program.program_id,
      title: program.title,
      courses: assembledCourses,
      final_quiz: finalQuiz,
      metadata: program.metadata || {},
      images: formattedImages,
    };

    return res.json(assembledProgram);
  } catch (err) {
    console.error("❌ Error assembling program:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

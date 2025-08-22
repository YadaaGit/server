// routes/apiRoutes.js
import express from "express";

export default function apiRoutes(models) {
  const router = express.Router();

  /**
   * GET /api/:lang/programs/:programId
   * Fetches a full program object with nested courses, modules, quizzes, and images
   */
  router.get("/:lang/programs/:programId", async (req, res) => {
    try {
      const { lang, programId } = req.params;

      const dbKey = `${lang}_courses`; // e.g. "AM_courses"
      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const { programs, courses, modules, final_quiz, images } = models[dbKey];

      // --- 1. fetch program ---
      const program = await programs.findOne({ program_id: programId }).lean();
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }

      // --- 2. fetch courses ---
      const courseIds = Object.values(program.courses_ids || {});
      const foundCourses = await courses
        .find({ course_id: { $in: courseIds } })
        .lean();

      // --- 3. fetch modules for each course ---
      const assembledCourses = await Promise.all(
        foundCourses.map(async (course) => {
          const moduleIds = Object.values(course.module_ids || {});
          const foundModules = await modules
            .find({ module_id: { $in: moduleIds } })
            .lean();
          return { ...course, modules: foundModules };
        })
      );

      // --- 4. fetch final quiz (if any) ---
      const finalQuiz = program.final_quiz_id
        ? await final_quiz.findOne({ quiz_id: program.final_quiz_id }).lean()
        : null;

      // --- 5. fetch images ---
      const allImages = await images.find({}).lean();
      const formattedImages = allImages.map((img) => ({
        ...img,
        coverImage: img.coverImage?.toString("base64") || null,
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

  return router;
}

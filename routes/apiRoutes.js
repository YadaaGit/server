// routes/apiRoutes.js
import express from "express";

export default function apiRoutes(models) {
  const router = express.Router();

  const resourceMap = {
    programs: "programs",
    courses: "courses",
    modules: "modules",
    final_quiz: "final_quiz",
    images: "images",
  };

  /**
   * GET /api/:lang/:resource
   * List all items in a resource
   */
  router.get("/:lang/:resource", async (req, res) => {
    try {
      const { lang, resource } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`; // e.g. EN_courses

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const items = await Model.find({}).lean();
      res.json(items);
    } catch (err) {
      console.error("❌ Error fetching resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * GET /api/:lang/:resource/:id
   * Get single item by ID
   */
  router.get("/:lang/:resource/:id", async (req, res) => {
    try {
      const { lang, resource, id } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const item = await Model.findById(id).lean();

      if (!item) return res.status(404).json({ error: "Item not found" });

      res.json(item);
    } catch (err) {
      console.error("❌ Error fetching item:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * GET /api/:lang/programs/:programId
   * Fetch full program object with nested courses, modules, final_quiz, and images
   */
  router.get("/:lang/programs/:programId", async (req, res) => {
    try {
      const { lang, programId } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const { programs, courses, modules, final_quiz, images } = models[dbKey];

      // --- Fetch program ---
      const program = await programs.findOne({ program_id: programId }).lean();
      if (!program) return res.status(404).json({ error: "Program not found" });

      // --- Fetch courses ---
      const courseIds = Object.values(program.courses_ids || {});
      const foundCourses = await courses.find({ course_id: { $in: courseIds } }).lean();

      // --- Fetch modules per course ---
      const assembledCourses = await Promise.all(
        foundCourses.map(async (course) => {
          const moduleIds = Object.values(course.module_ids || {});
          const foundModules = await modules.find({ module_id: { $in: moduleIds } }).lean();
          return { ...course, modules: foundModules };
        })
      );

      // --- Fetch final quiz ---
      const finalQuiz = program.final_quiz_id
        ? await final_quiz.findOne({ quiz_id: program.final_quiz_id }).lean()
        : null;

      // --- Fetch images ---
      const allImages = await images.find({}).lean();
      const formattedImages = allImages.map((img) => ({
        ...img,
        coverImage: img.coverImage?.toString("base64") || null,
      }));

      // --- Assemble final program ---
      const assembledProgram = {
        program_id: program.program_id,
        title: program.title,
        courses: assembledCourses,
        final_quiz: finalQuiz,
        metadata: program.metadata || {},
        images: formattedImages,
      };

      res.json(assembledProgram);
    } catch (err) {
      console.error("❌ Error assembling program:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}

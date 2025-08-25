// routes/apiRoutes.js
import express from "express";
import multer from "multer";
import crypto from "crypto"; // Needed for randomUUID

const storage = multer.memoryStorage();
const upload = multer({ storage });

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
  router.get("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const item = await Model.findOne({ uid }).lean();

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
  router.get("/:lang/programs/:uid", async (req, res) => {
    try {
      const { lang, uid } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const { programs, courses, modules, final_quiz, images } = models[dbKey];

      // --- Fetch program ---
      const program = await programs.findOne({ uid: uid }).lean();
      if (!program) return res.status(404).json({ error: "Program not found" });

      // --- Fetch courses ---
      const courseIds = Object.values(program.courses_ids || {});
      const foundCourses = await courses.find({ uid: { $in: courseIds } }).lean();

      // --- Fetch modules per course ---
      const assembledCourses = await Promise.all(
        foundCourses.map(async (course) => {
          const moduleIds = Object.values(course.module_ids || {});
          const foundModules = await modules.find({ uid: { $in: moduleIds } }).lean();
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

  /**
   * POST /api/:lang/:resource
   * Create a new item in a resource
   */
  router.post("/:lang/:resource", async (req, res) => {
    try {
      const { lang, resource } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const item = new Model(req.body);
      await item.save();
      res.status(201).json(item);
    } catch (err) {
      console.error("❌ Error creating resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * PUT /api/:lang/:resource/:id
   * Update an item by ID
   */
  router.put("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const updated = await Model.findOneAndUpdate({ uid }, req.body, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: "Item not found" });

      res.json(updated);
    } catch (err) {
      console.error("❌ Error updating resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * DELETE /api/:lang/:resource/:id
   * Delete an item by ID
   */
  router.delete("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const modelName = resourceMap[resource];
      if (!modelName) return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const deleted = await Model.findOneAndDelete({ uid }).lean();
      if (!deleted) return res.status(404).json({ error: "Item not found" });

      res.json({ success: true, deleted });
    } catch (err) {
      console.error("❌ Error deleting resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * POST /api/:lang/images
   * Upload image (multipart/form-data)
   */
  router.post("/:lang/images", upload.single("image"), async (req, res) => {
    try {
      const { lang } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;
      console.log("dbKey:", dbKey);
      console.log("req.file:", req.file);

      if (!models[dbKey]) {
        console.error("Invalid language collection:", dbKey);
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const Images = models[dbKey].images;

      if (!req.file) {
        console.error("No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newImage = new Images({
        uid: crypto.randomUUID(),
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        data: req.file.buffer,
      });

      await newImage.save();
      res.status(201).json({ uid: newImage.uid });
    } catch (err) {
      console.error("❌ Error uploading image:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * GET /api/:lang/images/:uid
   * Serve image by ID
   */
  router.get("/:lang/images/:uid", async (req, res) => {
    try {
      const { lang, uid } = req.params;
      const dbKey = `${lang.toUpperCase()}_courses`;

      if (!models[dbKey]) {
        return res.status(400).json({ error: "Invalid language collection" });
      }

      const Images = models[dbKey].images;
      const image = await Images.findOne({ uid });

      if (!image) return res.status(404).json({ error: "Image not found" });

      res.set("Content-Type", image.contentType);
      res.send(image.data);
    } catch (err) {
      console.error("❌ Error fetching image:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}

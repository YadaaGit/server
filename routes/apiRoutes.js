import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";

const upload = multer(); // use memory storage for images
const router = express.Router();

export default function createApiRoutes(models) {
  // Upload image
  router.post("/upload_image", upload.single("image"), async (req, res) => {
    try {
      const image_id = uuid();
      const newImage = new models.AM_courses.images({
        image_id,
        for: req.body.for || "general",
        title: req.body.title || "",
        coverImage: req.file.buffer,
      });
      await newImage.save();
      res.json({ image_id });
    } catch (err) {
      console.error("Error uploading image:", err.message);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Create quiz
  router.post("/quizzes", async (req, res) => {
    try {
      const newQuiz = new models.AM_courses.quizzes(req.body);
      await newQuiz.save();
      res.json({ quiz_id: newQuiz.quiz_id });
    } catch (err) {
      console.error("Error saving quiz:", err.message);
      res.status(500).json({ error: "Failed to save quiz" });
    }
  });

  // Create section
  router.post("/sections", async (req, res) => {
    try {
      const newSection = new models.AM_courses.sections(req.body);
      await newSection.save();
      res.json({ section_id: newSection.section_id });
    } catch (err) {
      console.error("Error saving section:", err.message);
      res.status(500).json({ error: "Failed to save section" });
    }
  });

  // Create module
  router.post("/modules", async (req, res) => {
    try {
      const newModule = new models.AM_courses.modules(req.body);
      await newModule.save();
      res.json({ module_id: newModule.module_id });
    } catch (err) {
      console.error("Error saving module:", err.message);
      res.status(500).json({ error: "Failed to save module" });
    }
  });

  // Create course with language DB selector
  router.post("/:db/courses", async (req, res) => {
    const { db } = req.params;
    if (!models[db]) {
      return res.status(400).json({ error: `Unknown DB: ${db}` });
    }
    try {
      const newCourse = new models[db].courses(req.body);
      await newCourse.save();
      res.json({ course_id: newCourse.course_id });
    } catch (err) {
      console.error("Error saving course:", err.message);
      res.status(500).json({ error: "Failed to save course" });
    }
  });

  // GeoIP & VPN detection
  router.get("/get-location", async (req, res) => {
    try {
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress;

      if (ip === "::1" || ip === "127.0.0.1") {
        return res.json({
          ip: "localhost",
          country: "Local",
          city: "Localhost",
          region: "Local",
          isVpn: false,
        });
      }

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geoData = await geoRes.json();

      const vpnRes = await fetch(`https://ip-api.com/json/${ip}?fields=proxy`);
      const vpnData = await vpnRes.json();

      const location = {
        ip,
        country: geoData.country_name,
        city: geoData.city,
        region: geoData.region,
        isVpn: vpnData.proxy || false,
      };

      res.json(location);
    } catch (err) {
      console.error("GeoIP/VPN detection error:", err.message);
      res.status(500).json({ error: "Failed to get location data" });
    }
  });

  // ✅ Custom Deep Update: update full program by program_id
  router.put("/:db/programs/update_by_id/:program_id", async (req, res) => {
    const { db, program_id } = req.params;
    const updatedProgramData = req.body;

    if (!models[db]) {
      return res.status(400).json({ error: `Unknown DB: ${db}` });
    }

    try {
      const updated = await models[db].programs.findOneAndUpdate(
        { program_id },
        updatedProgramData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Program not found" });
      }

      res.json({ success: true, updated });
    } catch (err) {
      console.error(`[${db}] Deep update error for program "${program_id}":`, err.message);
      res.status(500).json({ error: "Failed to update program" });
    }
  });

  // ✅ Generic CRUD routes for all collections
  for (const [dbKey, collections] of Object.entries(models)) {
    for (const [collectionName, model] of Object.entries(collections)) {
      const basePath = `/${dbKey}/${collectionName}`;

      // CREATE
      router.post(basePath, async (req, res) => {
        try {
          const doc = await model.create(req.body);
          res.status(201).json(doc);
        } catch (err) {
          console.error(`[${dbKey}] Create error in ${collectionName}:`, err.message);
          res.status(500).json({ error: "Create failed" });
        }
      });

      // READ ALL
      router.get(basePath, async (req, res) => {
        try {
          const docs = await model.find();
          res.json(docs);
        } catch (err) {
          console.error(`[${dbKey}] Read error in ${collectionName}:`, err.message);
          res.status(500).json({ error: "Read failed" });
        }
      });

      // READ ONE
      router.get(`${basePath}/:id`, async (req, res) => {
        try {
          const doc = await model.findById(req.params.id);
          if (!doc) return res.status(404).json({ error: "Not found" });
          res.json(doc);
        } catch (err) {
          console.error(`[${dbKey}] ReadOne error in ${collectionName}:`, err.message);
          res.status(500).json({ error: "Failed to fetch document" });
        }
      });

      // UPDATE
      router.put(`${basePath}/:id`, async (req, res) => {
        try {
          const updated = await model.findByIdAndUpdate(req.params.id, req.body, { new: true });
          if (!updated) return res.status(404).json({ error: "Not found" });
          res.json(updated);
        } catch (err) {
          console.error(`[${dbKey}] Update error in ${collectionName}:`, err.message);
          res.status(500).json({ error: "Update failed" });
        }
      });

      // DELETE
      router.delete(`${basePath}/:id`, async (req, res) => {
        try {
          const deleted = await model.findByIdAndDelete(req.params.id);
          if (!deleted) return res.status(404).json({ error: "Not found" });
          res.json({ success: true });
        } catch (err) {
          console.error(`[${dbKey}] Delete error in ${collectionName}:`, err.message);
          res.status(500).json({ error: "Delete failed" });
        }
      });
    }
  }

  return router;
}

// routes/apiRoutes.js
import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateCertificateImage } from "../utils/generateCertificatePDF.js";

dotenv.config();
const storage = multer.memoryStorage();
const upload = multer({ storage });

const FrontbaseUrl = process.env.FRONT_BASE_URL;
const BackbaseUrl = process.env.BACKEND_BASE_URL;

export default function apiRoutes(models) {
  const router = express.Router();

  const resourceMap = {
    programs: "Program",
    courses: "Course",
    modules: "Module",
    final_quiz: "FinalQuiz",
    images: "Image",
  };

  function getDbKey(lang) {
    if (lang.toLowerCase() === "certificates") return "CERTS";
    return `${lang.toUpperCase()}_courses`;
  }

  // ------------------- CERTIFICATE ROUTES -------------------
  if (models.CERTS && models.CERTS.Certificate) {
    const Certificate = models.CERTS.Certificate;

    // Issue a certificate
    router.post("/certificates", async (req, res) => {
      try {
        const { userName, courseTitle, score, certId, lang } = req.body;
        if (!userName || !courseTitle || !score || !certId) {
          return res.status(400).json({ ok: false, error: "Missing fields" });
        }

        const issueUrl = `${BackbaseUrl}/api/certificates/${certId}`;
        const verificationUrl = `${FrontbaseUrl}/certificates/${certId}`;

        const certDoc = new Certificate({
          userName,
          courseTitle,
          score,
          certId,
          issueDate: new Date(),
          issueUrl,
          verificationUrl,
          lang: lang || "am", // Save lang in DB for reference
        });
        await certDoc.save();

        const imageBuffer = await generateCertificateImage({
          userName,
          courseTitle,
          score,
          certId,
          verificationUrl,
          lang: lang || "am", // Use the passed language
        });

        const pngDir = path.join(process.cwd(), "certificates");
        if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);
        fs.writeFileSync(path.join(pngDir, `${certId}.png`), imageBuffer);

        res.json({
          ok: true,
          certificate: certDoc,
          imageUrl: `/certificates/${certId}.png`,
        });
      } catch (err) {
        console.error("❌ Error issuing certificate:", err);
        res
          .status(500)
          .json({ ok: false, error: "Failed to issue certificate" });
      }
    });

    // Serve static PNGs
    router.use("/certificates", express.static("certificates"));

    // Get certificate JSON
    router.get("/certificates/:certId", async (req, res) => {
      try {
        const { certId } = req.params;
        const cert = await Certificate.findOne({ certId });
        if (!cert)
          return res.status(404).json({ error: "Certificate not found" });
        res.json(cert);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Get certificate PNG dynamically
    router.get("/certificates/:certId/image", async (req, res) => {
      try {
        const { certId } = req.params;
        const cert = await Certificate.findOne({ certId });
        if (!cert)
          return res.status(404).json({ error: "Certificate not found" });

        const imageBuffer = await generateCertificateImage({
          userName: cert.userName,
          courseTitle: cert.courseTitle,
          score: cert.score,
          certId: cert.certId,
          issueDate: cert.issueDate,
          verificationUrl: cert.verificationUrl,
          lang: cert.lang || "am",
        });

        res.set({
          "Content-Type": "image/png",
          "Content-Disposition": `inline; filename="${cert.certId}.png"`,
        });
        res.send(imageBuffer);
      } catch (err) {
        console.error("Image generation failed:", err);
        res.status(500).json({ error: "Failed to generate certificate image" });
      }
    });
  }

  // ------------------- GENERIC API ROUTES -------------------

  // GET list
  router.get("/:lang/:resource", async (req, res) => {
    try {
      const { lang, resource } = req.params;
      const dbKey = getDbKey(lang);
      if (!models[dbKey])
        return res
          .status(400)
          .json({ error: "Invalid language or collection" });

      if (dbKey === "CERTS") {
        const Certificate = models.CERTS.Certificate;
        const items = await Certificate.find({}).lean();
        return res.json(items);
      }

      const modelName = resourceMap[resource];
      if (!modelName)
        return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const items = await Model.find({}).lean();
      res.json(items);
    } catch (err) {
      console.error("❌ Error fetching resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET single item
  router.get("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = getDbKey(lang);
      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

      if (dbKey === "CERTS") {
        const Certificate = models.CERTS.Certificate;
        const item = await Certificate.findOne({ certId: uid }).lean();
        if (!item)
          return res.status(404).json({ error: "Certificate not found" });
        return res.json(item);
      }

      const modelName = resourceMap[resource];
      if (!modelName)
        return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const item = await Model.findOne({ uid }).lean();
      if (!item) return res.status(404).json({ error: "Item not found" });

      res.json(item);
    } catch (err) {
      console.error("❌ Error fetching item:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST new item (non-image)
  router.post("/:lang/:resource", async (req, res) => {
    try {
      const { lang, resource } = req.params;
      const dbKey = getDbKey(lang);

      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

      if (dbKey === "CERTS")
        return res
          .status(400)
          .json({ error: "Use /certificates to create a certificate" });

      if (resource === "images")
        return res
          .status(400)
          .json({ error: "Use /images endpoint for images" });

      const modelName = resourceMap[resource];
      if (!modelName)
        return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const bodyWithUid = { uid: crypto.randomUUID(), ...req.body };
      const item = new Model(bodyWithUid);
      await item.save();

      res.status(201).json(item);
    } catch (err) {
      console.error("❌ Error creating resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // PUT update item
  router.put("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = getDbKey(lang);

      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

      if (dbKey === "CERTS")
        return res
          .status(400)
          .json({ error: "Cannot update certificate via API" });

      const modelName = resourceMap[resource];
      if (!modelName)
        return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const updated = await Model.findOneAndUpdate({ uid }, req.body, {
        new: true,
      }).lean();
      if (!updated) return res.status(404).json({ error: "Item not found" });

      res.json(updated);
    } catch (err) {
      console.error("❌ Error updating resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // DELETE item
  router.delete("/:lang/:resource/:uid", async (req, res) => {
    try {
      const { lang, resource, uid } = req.params;
      const dbKey = getDbKey(lang);

      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

      if (dbKey === "CERTS")
        return res
          .status(400)
          .json({ error: "Cannot delete certificate via API" });

      const modelName = resourceMap[resource];
      if (!modelName)
        return res.status(404).json({ error: "Unknown resource" });

      const Model = models[dbKey][modelName];
      const deleted = await Model.findOneAndDelete({ uid }).lean();
      if (!deleted) return res.status(404).json({ error: "Item not found" });

      res.json({ success: true, deleted });
    } catch (err) {
      console.error("❌ Error deleting resource:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST upload image
  router.post("/:lang/images", upload.single("image"), async (req, res) => {
    try {
      const { lang } = req.params;
      const dbKey = getDbKey(lang);

      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

      const Images = models[dbKey].images;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

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

  // GET image by UID
  router.get("/:lang/images/:uid", async (req, res) => {
    try {
      const { lang, uid } = req.params;
      const dbKey = getDbKey(lang);

      if (!models[dbKey])
        return res.status(400).json({ error: "Invalid collection" });

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

// routes/certificateRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateCertificatePDF } from "../utils/generateCertificatePDF.js";
dotenv.config();

export default function certificateRoutes(models) {
  const router = express.Router();
  const Certificate = models.CERTS.Certificate;

  // issue certificate
  router.post("/issue", async (req, res) => {
    try {
      const { userName, courseTitle, score, certId } = req.body;
      if (!userName || !courseTitle || !score || !certId) {
        return res.status(400).json({ ok: false, error: "Missing fields" });
      }

      // 1. save to DB
      const verificationUrl = `${process.env.BASE_URL}/api/certificates/certificates/${certId}`;
      const certDoc = new Certificate({
        userName,
        courseTitle,
        score,
        certId,
        issuedAt: new Date(),
        verificationUrl,
      });
      await certDoc.save();

      // 2. generate PDF
      const pdfBuffer = await generateCertificatePDF({
        userName,
        courseTitle,
        score,
        certId,
        verificationUrl,
      });

      // 3. write to disk
      const pdfDir = path.join(process.cwd(), "certificates");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);
      const pdfPath = path.join(pdfDir, `${certId}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // 4. return URL
      res.json({
        ok: true,
        certificate: certDoc,
        pdfUrl: `/certificates/${certId}.pdf`,
      });
    } catch (err) {
      console.error("❌ Error issuing certificate:", err);
      res.status(500).json({ ok: false, error: "Failed to issue certificate" });
    }
  });

  // static serving
  router.use("/", express.static("certificates"));

  return router;
}

import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import FormData from "form-data";
import path from "path";

const router = express.Router();

router.post("/send-document", async (req, res) => {
  const { chatId, filePath, caption } = req.body;
  const botToken = process.env.BOT_TOKEN;

  if (!chatId || !filePath) {
    return res.status(400).json({ ok: false, error: "Missing chatId or filePath" });
  }

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", fs.createReadStream(path.resolve(filePath)));
    if (caption) form.append("caption", caption);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: form,
    });

    const data = await response.json();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
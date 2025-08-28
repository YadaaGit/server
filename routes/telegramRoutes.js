import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/send-document", async (req, res) => {
  const { chatId, fileUrl, caption } = req.body; // rename to fileUrl
  const botToken = process.env.BOT_TOKEN;

  if (!chatId || !fileUrl) {
    return res.status(400).json({ ok: false, error: "Missing chatId or fileUrl" });
  }

  try {
    // Telegram API accepts URLs directly
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: fileUrl,
        caption: caption || "",
      }),
    });

    const data = await response.json();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

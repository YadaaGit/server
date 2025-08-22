import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import QRCode from "qrcode";

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateCertificatePDF({
  userName,
  courseTitle,
  score,
  certId,
  verificationUrl,
  date = new Date(),
}) {
  const htmlPath = path.resolve("server/templates/certificate.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  // Generate QR Code as Data URI
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);

  html = html
    .replace(/{{USER_NAME}}/g, userName)
    .replace(/{{COURSE_TITLE}}/g, courseTitle)
    .replace(/{{SCORE}}/g, String(score))
    .replace(/{{DATE}}/g, formatDate(date))
    .replace(/{{CERT_ID}}/g, certId)
    .replace(/{{QR_CODE}}/g, qrDataUrl);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("screen");

  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
  });

  await browser.close();
  return pdf;
}

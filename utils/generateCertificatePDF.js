import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateCertificateImage({
  userName,
  courseTitle,
  score,
  certId,
  verificationUrl,
  issueDate = new Date(),
}) {
  // Load template
  const htmlPath = path.join(__dirname, "../templates/certificate.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  // Fix asset paths
  const assetsDir = path.join(__dirname, "../templates/assets");
  const assetsFile = pathToFileURL(assetsDir).href;
  html = html.replace(/\.\/assets\//g, `${assetsFile}/`);

  // Inject data
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);
  html = html
    .replace(/{{USER_NAME}}/g, userName)
    .replace(/{{COURSE_TITLE}}/g, courseTitle ?? "")
    .replace(/{{SCORE}}/g, String(score ?? ""))
    .replace(/{{DATE}}/g, formatDate(issueDate))
    .replace(/{{CERT_ID}}/g, certId)
    .replace(/{{QR_CODE}}/g, qrDataUrl);

  // Write temporary HTML file
  const tempHtmlPath = path.join(os.tmpdir(), `${certId}.html`);
  fs.writeFileSync(tempHtmlPath, html);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({
    width: 3508,
    height: 2480,
    deviceScaleFactor: 1,
  });

  // Use page.goto() instead of setContent()
  await page.goto(pathToFileURL(tempHtmlPath).href, {
    waitUntil: "networkidle0",
  });

  // Take screenshot
  const imageBuffer = await page.screenshot({ type: "png", fullPage: true });

  await browser.close();

  // Remove temp file
  fs.unlinkSync(tempHtmlPath);

  return imageBuffer;
}

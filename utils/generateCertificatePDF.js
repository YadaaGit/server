import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import puppeteer from "puppeteer";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateCertificatePDF({
  userName,
  courseTitle,
  score,
  certId,
  verificationUrl,
  issueDate = new Date(),
}) {
  // Load template + css
  const htmlPath = path.join(__dirname, "../templates/certificate.html");
  let html       = fs.readFileSync(htmlPath, "utf8");

  // Fix relative asset paths to absolute file:// URLs so Puppeteer can embed them
  const assetsDir  = path.join(__dirname, "../templates/assets");
  const assetsFile = pathToFileURL(assetsDir).href;                // file:///.../assets
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

  // Render with Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Inline CSS so we don't need network fetches
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("screen");

  const pdfBuffer = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}

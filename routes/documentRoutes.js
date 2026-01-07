const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mammoth = require("mammoth"); // DOCX -> HTML
const ExcelJS = require("exceljs"); // Excel <-> CSV
const marked = require("marked"); // Markdown -> HTML
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.warn("Puppeteer not found, PDF conversion will be disabled");
}
const { PDFDocument } = require("pdf-lib"); // PDF manipulation

// Configure Multer for documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "text/csv", // csv
      "text/plain", // txt
      "text/markdown", // md
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith(".md") ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

// Helper: Convert HTML to PDF using Puppeteer
const convertHtmlToPdf = async (htmlContent, outputPath) => {
  if (!puppeteer) {
    throw new Error("PDF conversion unavailable (Puppeteer missing)");
  }
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  await page.pdf({ path: outputPath, format: "A4", printBackground: true });
  await browser.close();
};

// 1. DOCX to PDF / HTML
router.post("/docx", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const format = req.body.format || "pdf"; // pdf or html
    const outputFilename = `${
      path.parse(req.file.originalname).name
    }.${format}`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ path: inputPath });
    const html = `
      <html>
        <head>
          <style>body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }</style>
        </head>
        <body>${result.value}</body>
      </html>
    `;

    if (format === "html") {
      fs.writeFileSync(outputPath, html);
    } else {
      await convertHtmlToPdf(html, outputPath);
    }

    // Cleanup input
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("DOCX conversion error:", error);
    res.status(500).json({ error: "Conversion failed: " + error.message });
  }
});

// 2. Excel (XLSX <-> CSV)
router.post("/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const targetFormat = req.body.format || "csv"; // csv or xlsx
    const outputFilename = `${
      path.parse(req.file.originalname).name
    }.${targetFormat}`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    const workbook = new ExcelJS.Workbook();

    if (req.file.originalname.endsWith(".csv") && targetFormat === "xlsx") {
      // CSV -> XLSX
      await workbook.csv.readFile(inputPath);
      await workbook.xlsx.writeFile(outputPath);
    } else if (
      req.file.originalname.endsWith(".xlsx") &&
      targetFormat === "csv"
    ) {
      // XLSX -> CSV
      await workbook.xlsx.readFile(inputPath);
      await workbook.csv.writeFile(outputPath);
    } else if (targetFormat === "pdf") {
      // XLSX -> PDF (Basic Table Render)
      await workbook.xlsx.readFile(inputPath);
      const worksheet = workbook.worksheets[0];
      let html =
        "<html><head><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }</style></head><body><table>";

      worksheet.eachRow((row) => {
        html += "<tr>";
        row.eachCell((cell) => {
          html += `<td>${cell.value}</td>`;
        });
        html += "</tr>";
      });
      html += "</table></body></html>";

      await convertHtmlToPdf(html, outputPath);
    } else {
      return res.status(400).json({ error: "Invalid conversion combination" });
    }

    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("Excel conversion error:", error);
    res.status(500).json({ error: "Conversion failed: " + error.message });
  }
});

// 3. Markdown/Text to PDF
router.post("/text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const outputFilename = `${path.parse(req.file.originalname).name}.pdf`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    const content = fs.readFileSync(inputPath, "utf8");
    let html = "";

    if (req.file.originalname.endsWith(".md")) {
      html = marked.parse(content);
    } else {
      // Plain text
      html = `<pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>`;
    }

    const finalHtml = `
      <html>
        <head>
          <style>body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }</style>
        </head>
        <body>${html}</body>
      </html>
    `;

    await convertHtmlToPdf(finalHtml, outputPath);
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("Text conversion error:", error);
    res.status(500).json({ error: "Conversion failed: " + error.message });
  }
});

module.exports = router;

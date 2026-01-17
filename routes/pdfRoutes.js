const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const JSZip = require("jszip");

// Configure Multer for PDF
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
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Helper: Parse range string (e.g., "1-5, 8, 11-13")
const parseRange = (rangeStr, totalPages) => {
  const pages = new Set();
  const parts = rangeStr.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) pages.add(i - 1); // 0-indexed
        }
      }
    } else {
      const page = Number(trimmed);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
};

// Split PDF Endpoint
router.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const { mode = "chunk", chunkSize = 10, range = "" } = req.body;

    // Load PDF
    console.log(`Loading PDF: ${req.file.originalname}`);
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const totalPages = pdfDoc.getPageCount();
    console.log(`Total Pages Detected: ${totalPages}`);
    const originalName = path.parse(req.file.originalname).name;

    const zip = new JSZip();
    let splitCount = 0;

    if (mode === "chunk") {
      // Split into chunks of N pages
      const size = parseInt(chunkSize) || 10;

      for (let i = 0; i < totalPages; i += size) {
        const subDoc = await PDFDocument.create();
        const end = Math.min(i + size, totalPages);
        console.log(
          `Processing chunk ${Math.floor(i / size) + 1}: Pages ${
            i + 1
          } to ${end}`
        );

        // Copy pages
        const pageIndices = [];
        for (let j = i; j < end; j++) pageIndices.push(j);

        const copiedPages = await subDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

        const pdfBytes = await subDoc.save();
        const partNum = Math.floor(i / size) + 1;
        zip.file(`${originalName}_part_${partNum}.pdf`, pdfBytes);
        splitCount++;
      }
    } else if (mode === "extract") {
      // Extract specific pages
      const pagesToExtract = parseRange(range, totalPages);

      if (pagesToExtract.length === 0) {
        return res.status(400).json({ error: "Invalid page range" });
      }

      const subDoc = await PDFDocument.create();
      const copiedPages = await subDoc.copyPages(pdfDoc, pagesToExtract);
      copiedPages.forEach((page) => subDoc.addPage(page));

      const pdfBytes = await subDoc.save();
      zip.file(`${originalName}_extracted.pdf`, pdfBytes);
      splitCount = 1;
    } else if (mode === "single") {
      // Split every page into a separate file (Caution: High file count)
      for (let i = 0; i < totalPages; i++) {
        const subDoc = await PDFDocument.create();
        const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
        subDoc.addPage(copiedPage);

        const pdfBytes = await subDoc.save();
        zip.file(`${originalName}_page_${i + 1}.pdf`, pdfBytes);
        splitCount++;
      }
    }

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    const outputFilename = `${originalName}_split.zip`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    fs.writeFileSync(outputPath, zipContent);

    // Cleanup input
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      message: `Successfully split into ${splitCount} files`,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("PDF Split error:", error);
    res.status(500).json({ error: "Split failed: " + error.message });
  }
});

module.exports = router;

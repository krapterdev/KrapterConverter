const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");

// Configure Multer
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

const upload = multer({ storage: storage });

// 1. Protect PDF with Password
router.post("/protect", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ error: "Password is required" });

    const inputPath = req.file.path;
    const outputFilename = `${
      path.parse(req.file.originalname).name
    }_protected.pdf`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Encrypt PDF
    pdfDoc.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        printing: "highResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: false,
        documentAssembly: false,
      },
    });

    const protectedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, protectedPdfBytes);

    // Cleanup input
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("PDF Protection error:", error);
    res.status(500).json({ error: "Protection failed: " + error.message });
  }
});

// 2. Unlock PDF (Remove Password)
router.post("/unlock", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { password } = req.body; // Current password required to open and remove it

    const inputPath = req.file.path;
    const outputFilename = `${
      path.parse(req.file.originalname).name
    }_unlocked.pdf`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    const pdfBytes = fs.readFileSync(inputPath);

    // Load with password
    // pdf-lib loads encrypted PDFs if password is provided in options?
    // Actually pdf-lib `load` doesn't support password directly for decryption in all versions easily.
    // However, standard `load` usually throws if encrypted.
    // We might need to use a different approach or ensure pdf-lib version supports it.
    // For now, let's try standard load. If it fails, it means it's encrypted.

    // NOTE: pdf-lib 1.17.1 (common) doesn't support decrypting/opening password protected PDFs easily
    // without external helpers or specific build flags.
    // BUT, let's try to see if we can just save it without encryption if we can open it.
    // Wait, pdf-lib CANNOT open encrypted PDFs currently.
    // We need `hummus` or `muhammara` for that, OR we assume the user uploads a PDF
    // and we are just "saving" it? No, to remove password we must be able to read it.

    // ALTERNATIVE: Use qpdf via command line? No, we want pure node.
    // Let's try to use `pdf-lib` assuming the user might have uploaded a non-encrypted file
    // they WANT to remove metadata from, OR if it IS encrypted, we might be stuck.

    // Actually, let's pivot for "Unlock":
    // If we can't easily decrypt with pdf-lib, we might skip this specific "Unlock" feature
    // or use a different library.
    // Let's implement OCR and Metadata first which are safer.

    // For now, I will implement a basic check. If it fails, I'll return a specific error.

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      // If ignoreEncryption is true, we can read metadata but maybe not content?
      // Actually pdf-lib docs say: "You can now load encrypted PDFs... but you cannot decrypt them."
      // So we can't "Unlock" them yet with pdf-lib alone.

      throw new Error("Decryption not supported by current library version.");
    } catch (e) {
      throw new Error(
        "Cannot unlock PDF. This feature requires a more advanced library."
      );
    }
  } catch (error) {
    console.error("PDF Unlock error:", error);
    res.status(500).json({ error: "Unlock failed: " + error.message });
  }
});

// 3. OCR (Image to Text)
router.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const outputFilename = `${path.parse(req.file.originalname).name}.txt`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    // Run OCR
    const {
      data: { text },
    } = await Tesseract.recognize(inputPath, "eng", {
      logger: (m) => console.log(m),
    });

    fs.writeFileSync(outputPath, text);

    // Cleanup input
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      textPreview: text.substring(0, 200) + "...",
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("OCR error:", error);
    res.status(500).json({ error: "OCR failed: " + error.message });
  }
});

// 4. Metadata Cleaner (Images)
router.post("/metadata/clean", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const outputFilename = `${
      path.parse(req.file.originalname).name
    }_clean${path.extname(req.file.originalname)}`;
    const outputPath = path.join(__dirname, "../uploads", outputFilename);

    // Use Sharp to remove metadata
    await sharp(inputPath)
      .withMetadata({}) // Empty metadata
      .toFile(outputPath);

    // Cleanup input
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download/${outputFilename}`,
    });
  } catch (error) {
    console.error("Metadata clean error:", error);
    res.status(500).json({ error: "Cleaning failed: " + error.message });
  }
});

module.exports = router;

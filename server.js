require("dotenv").config();
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JSZip = require("jszip");
const PDFDocument = require("pdfkit");
const pdf = require("pdf-poppler");

// Import Models
const User = require("./models/User");
const Admin = require("./models/Admin");
const Conversion = require("./models/Conversion");
const ApiUsage = require("./models/ApiUsage");

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/krapter-convertor",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Create default user if not exists
const createDefaultUser = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash("Sahil@123", 10);
      await User.create({
        username: "krapter",
        email: "krapter@example.com",
        password: hashedPassword,
        status: "active",
      });
      console.log("Default user created: krapter/Sahil@123");
    }

    // Also create default admin if needed
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash("Sahil@123", 10);
      await Admin.create({
        username: "admin",
        password: hashedPassword,
      });
      console.log("Default admin created: admin/Sahil@123");
    }
  } catch (error) {
    console.error("Error creating default users:", error);
  }
};
createDefaultUser();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Import Routes
const documentRoutes = require("./routes/documentRoutes");

// Mount Routes
app.use("/convert/document", documentRoutes);

// API Usage Middleware
app.use(async (req, res, next) => {
  const start = Date.now();
  res.on("finish", async () => {
    try {
      // Skip logging for static files or uploads
      if (req.path.startsWith("/uploads") || req.path.startsWith("/static"))
        return;

      await ApiUsage.create({
        endpoint: req.path,
        method: req.method,
        userId: req.user ? req.user.username : req.admin ? "admin" : null,
        responseTime: Date.now() - start,
        statusCode: res.statusCode,
      });
    } catch (error) {
      // Silent fail for logging
      console.error("Error tracking API usage:", error);
    }
  });
  next();
});

// Auth middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Access denied" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Access denied" });
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret"
    );
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
      "image/tiff",
      "image/bmp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const uploadPdf = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// User login
app.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email });

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: email }, { username: email }],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ error: "Account is banned" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      console.log("Login successful");
      const token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          type: "user",
        },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "24h" }
      );

      res.json({ success: true, token, username: user.username });
    } else {
      console.log("Login failed - invalid credentials");
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Universal Image Converter with editing features
app.post(
  "/convert",
  authenticateUser,
  upload.array("images", 20),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const {
        format,
        quality = "high",
        resize = {},
        crop = {},
        rotate = 0,
        filters = {},
      } = req.body;

      const convertedFiles = [];

      // Quality settings
      const qualitySettings = {
        low: { jpeg: 40, webp: 40, avif: 40, png: 6 },
        medium: { jpeg: 70, webp: 70, avif: 70, png: 4 },
        high: { jpeg: 90, webp: 90, avif: 90, png: 2 },
        lossless: { jpeg: 100, webp: 100, avif: 100, png: 0 },
      };

      // Get file order if provided
      const fileOrder = req.body.fileOrder
        ? JSON.parse(req.body.fileOrder)
        : null;
      const orderedFiles = fileOrder
        ? fileOrder.map((index) => req.files[index]).filter(Boolean)
        : req.files;

      const startTime = Date.now();

      // Process each file in order
      for (let i = 0; i < orderedFiles.length; i++) {
        const file = orderedFiles[i];
        const inputPath = file.path;
        const originalName = path.parse(file.originalname).name;
        const outputFilename = `${originalName}_KrapterConverter.${format}`;
        const outputPath = path.join("uploads", outputFilename);

        console.log(
          `Processing file ${i + 1}/${orderedFiles.length}: ${
            file.originalname
          }`
        );

        try {
          let sharpInstance = sharp(inputPath);

          // Check if input is AVIF and handle accordingly
          const fileMetadata = await sharpInstance.metadata();
          console.log(`File format: ${fileMetadata.format}`);
        } catch (sharpError) {
          console.error(
            `Sharp error for ${file.originalname}:`,
            sharpError.message
          );
          // Skip this file and continue
          fs.unlinkSync(inputPath);
          continue;
        }

        let sharpInstance = sharp(inputPath);

        // Apply transformations

        // 1. Resize
        if (resize.width || resize.height) {
          const resizeOptions = {
            width: resize.width ? parseInt(resize.width) : undefined,
            height: resize.height ? parseInt(resize.height) : undefined,
            fit: resize.fit || "inside",
            withoutEnlargement: resize.withoutEnlargement !== false,
          };
          sharpInstance = sharpInstance.resize(resizeOptions);
        }

        // 2. Crop
        if (crop.width && crop.height) {
          sharpInstance = sharpInstance.extract({
            left: parseInt(crop.x) || 0,
            top: parseInt(crop.y) || 0,
            width: parseInt(crop.width),
            height: parseInt(crop.height),
          });
        }

        // 3. Rotate
        if (rotate && rotate !== 0) {
          sharpInstance = sharpInstance.rotate(parseInt(rotate));
        }

        // 4. Advanced Color Filters
        if (filters.brightness || filters.contrast || filters.saturation) {
          sharpInstance = sharpInstance.modulate({
            brightness: filters.brightness ? parseFloat(filters.brightness) : 1,
            saturation: filters.saturation ? parseFloat(filters.saturation) : 1,
            hue: filters.hue ? parseInt(filters.hue) : 0,
          });
        }

        if (filters.contrast && filters.contrast !== 1) {
          sharpInstance = sharpInstance.linear(
            parseFloat(filters.contrast),
            -(128 * parseFloat(filters.contrast)) + 128
          );
        }

        if (filters.blur && filters.blur > 0) {
          sharpInstance = sharpInstance.blur(parseFloat(filters.blur));
        }

        if (filters.sharpen && filters.sharpen > 0) {
          sharpInstance = sharpInstance.sharpen(parseFloat(filters.sharpen));
        }

        if (filters.greyscale) {
          sharpInstance = sharpInstance.greyscale();
        }

        if (filters.sepia) {
          sharpInstance = sharpInstance.tint({ r: 255, g: 240, b: 196 });
        }

        if (filters.tint && filters.tint.enabled) {
          sharpInstance = sharpInstance.tint({
            r: parseInt(filters.tint.r) || 255,
            g: parseInt(filters.tint.g) || 255,
            b: parseInt(filters.tint.b) || 255,
          });
        }

        // 5. Watermark
        const watermark = JSON.parse(req.body.watermark || "{}");
        if (watermark.enabled) {
          const metadata = await sharpInstance.metadata();
          const { width, height } = metadata;

          if (watermark.type === "text" && watermark.text) {
            // Create text watermark using SVG
            const fontSize = watermark.fontSize || 24;
            const opacity = watermark.opacity || 0.5;

            // Calculate position
            let x = 10,
              y = 30;
            switch (watermark.position) {
              case "top-right":
                x = width - watermark.text.length * fontSize * 0.6 - 10;
                y = 30;
                break;
              case "bottom-left":
                x = 10;
                y = height - 10;
                break;
              case "bottom-right":
                x = width - watermark.text.length * fontSize * 0.6 - 10;
                y = height - 10;
                break;
              case "center":
                x = (width - watermark.text.length * fontSize * 0.6) / 2;
                y = height / 2;
                break;
            }

            const svgText = `
            <svg width="${width}" height="${height}">
              <text x="${x}" y="${y}" 
                    font-family="Arial" 
                    font-size="${fontSize}" 
                    fill="white" 
                    fill-opacity="${opacity}"
                    stroke="black" 
                    stroke-width="1" 
                    stroke-opacity="${opacity * 0.5}">
                ${watermark.text}
              </text>
            </svg>
          `;

            const textBuffer = Buffer.from(svgText);
            sharpInstance = sharpInstance.composite([
              {
                input: textBuffer,
                blend: "over",
              },
            ]);
          }
        }

        // 5. EXIF Metadata handling
        const metadata = JSON.parse(req.body.metadata || "{}");
        if (metadata.removeAll) {
          // Remove all metadata
          sharpInstance = sharpInstance.withMetadata({});
        } else if (metadata.removeGPS) {
          // Keep metadata but remove GPS data
          const currentMetadata = await sharpInstance.metadata();
          const cleanMetadata = { ...currentMetadata };
          delete cleanMetadata.exif;
          sharpInstance = sharpInstance.withMetadata(cleanMetadata);
        } else if (metadata.keep) {
          // Keep all metadata
          sharpInstance = sharpInstance.withMetadata();
        }

        // 6. Format conversion with quality
        const currentQuality = qualitySettings[quality] || qualitySettings.high;

        switch (format) {
          case "jpeg":
          case "jpg":
            await sharpInstance
              .jpeg({
                quality: currentQuality.jpeg,
                progressive: true,
                mozjpeg: true,
              })
              .toFile(outputPath);
            break;
          case "png":
            await sharpInstance
              .png({
                compressionLevel: currentQuality.png,
                quality: quality === "lossless" ? 100 : currentQuality.jpeg,
              })
              .toFile(outputPath);
            break;
          case "webp":
            await sharpInstance
              .webp({
                quality: currentQuality.webp,
                lossless: quality === "lossless",
              })
              .toFile(outputPath);
            break;
          case "avif":
            await sharpInstance
              .avif({
                quality: currentQuality.avif,
                lossless: quality === "lossless",
              })
              .toFile(outputPath);
            break;
          case "tiff":
            await sharpInstance
              .tiff({
                quality: currentQuality.jpeg,
                compression: quality === "lossless" ? "none" : "jpeg",
              })
              .toFile(outputPath);
            break;
          case "gif":
            await sharpInstance.gif().toFile(outputPath);
            break;
          case "bmp":
            await sharpInstance.toFormat("bmp").toFile(outputPath);
            break;
          case "heif":
            await sharpInstance
              .heif({
                quality: currentQuality.jpeg,
                lossless: quality === "lossless",
              })
              .toFile(outputPath);
            break;
          default:
            await sharpInstance
              .toFormat(format, { quality: currentQuality.jpeg })
              .toFile(outputPath);
        }

        // Clean up input file
        fs.unlinkSync(inputPath);

        convertedFiles.push({
          originalName: file.originalname,
          downloadUrl: `/download/${outputFilename}`,
        });
      }

      // Enhanced analytics tracking
      const userAgent = req.get("User-Agent") || "";
      const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent)
        ? "mobile"
        : "desktop";
      const totalSize = orderedFiles.reduce((sum, file) => sum + file.size, 0);
      const inputFormats = [
        ...new Set(
          orderedFiles.map((file) => {
            const ext = path.extname(file.originalname).toLowerCase().slice(1);
            return ext || "unknown";
          })
        ),
      ];

      // Store conversion in database
      await Conversion.create({
        userId: req.user.username,
        originalFiles: orderedFiles.map((f) => f.originalname),
        inputFormats: inputFormats,
        outputFormat: format,
        convertedFiles: convertedFiles.map((f) => f.originalName),
        fileCount: orderedFiles.length,
        totalSize: totalSize,
        processingTime: Date.now() - startTime,
        deviceType: deviceType,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `${convertedFiles.length} files converted successfully`,
        files: convertedFiles,
      });
    } catch (error) {
      console.error("Conversion error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: "Conversion failed: " + error.message });
    }
  }
);

// Download converted file
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (!err) {
        // Delete file after download
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000);
      }
    });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Admin login
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ success: true, token, username });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Get conversion history (admin only)
app.get("/admin/history", authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversions = await Conversion.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Conversion.countDocuments();

    res.json({
      success: true,
      conversions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Get comprehensive analytics (admin only)
app.get("/admin/analytics", authenticateAdmin, async (req, res) => {
  try {
    const totalConversions = await Conversion.countDocuments();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayConversions = await Conversion.countDocuments({
      timestamp: { $gte: todayStart },
    });

    // Most used output formats
    const outputFormatStats = await Conversion.aggregate([
      { $group: { _id: "$outputFormat", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Most used input formats
    const inputFormatStats = await Conversion.aggregate([
      { $unwind: "$inputFormats" },
      { $group: { _id: "$inputFormats", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Daily conversion trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Conversion.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          count: { $sum: 1 },
          filesProcessed: { $sum: "$fileCount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Device statistics
    const deviceStats = await Conversion.aggregate([
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Active users (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeUsers = await Conversion.aggregate([
      { $match: { timestamp: { $gte: weekAgo } } },
      {
        $group: {
          _id: "$userId",
          conversions: { $sum: 1 },
          lastActive: { $max: "$timestamp" },
          totalFiles: { $sum: "$fileCount" },
        },
      },
      { $sort: { conversions: -1 } },
      { $limit: 20 },
    ]);

    // Top converted file types
    const topFileTypes = await Conversion.aggregate([
      { $unwind: "$originalFiles" },
      {
        $group: {
          _id: "$originalFiles",
          count: { $sum: 1 },
          formats: { $addToSet: "$outputFormat" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    // Processing performance
    const avgProcessingTime = await Conversion.aggregate([
      { $match: { processingTime: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$processingTime" },
          totalSize: { $sum: "$totalSize" },
          totalFiles: { $sum: "$fileCount" },
        },
      },
    ]);

    res.json({
      success: true,
      analytics: {
        overview: {
          totalConversions,
          todayConversions,
          avgProcessingTime: avgProcessingTime[0]?.avgTime || 0,
          totalFilesProcessed: avgProcessingTime[0]?.totalFiles || 0,
        },
        formats: {
          input: inputFormatStats,
          output: outputFormatStats,
        },
        trends: {
          daily: dailyStats,
        },
        devices: deviceStats,
        users: {
          active: activeUsers,
        },
        files: {
          topConverted: topFileTypes,
        },
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Keep old stats endpoint for compatibility
app.get("/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const totalConversions = await Conversion.countDocuments();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayConversions = await Conversion.countDocuments({
      timestamp: { $gte: todayStart },
    });

    const formatStats = await Conversion.aggregate([
      { $group: { _id: "$outputFormat", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalConversions,
        todayConversions,
        formatStats,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Download All as ZIP
app.post("/download-zip", authenticateUser, async (req, res) => {
  try {
    const { files } = req.body; // Array of file paths

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files to zip" });
    }

    const zip = new JSZip();

    // Add each file to ZIP
    for (const filePath of files) {
      const fullPath = path.join(__dirname, "uploads", path.basename(filePath));
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        zip.file(path.basename(filePath), fileBuffer);
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="converted_images.zip"',
      "Content-Length": zipBuffer.length,
    });

    res.send(zipBuffer);

    // Clean up files after sending
    setTimeout(() => {
      files.forEach((filePath) => {
        const fullPath = path.join(
          __dirname,
          "uploads",
          path.basename(filePath)
        );
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }, 5000);
  } catch (error) {
    console.error("ZIP creation error:", error);
    res.status(500).json({ error: "Failed to create ZIP" });
  }
});

// Convert Images to PDF
app.post(
  "/convert-to-pdf",
  authenticateUser,
  upload.array("images", 20),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      const { pageSize = "A4", orientation = "portrait" } = req.body;

      // Create PDF document
      const doc = new PDFDocument({
        size: pageSize.toUpperCase(),
        layout: orientation,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));

      const pdfPromise = new Promise((resolve) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
      });

      // Add each image to PDF
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        // Process image with Sharp to ensure compatibility
        const processedBuffer = await sharp(file.path)
          .jpeg({ quality: 90 })
          .toBuffer();

        if (i > 0) {
          doc.addPage();
        }

        // Fit image to page
        const pageWidth = doc.page.width - 100;
        const pageHeight = doc.page.height - 100;

        doc.image(processedBuffer, 50, 50, {
          fit: [pageWidth, pageHeight],
          align: "center",
          valign: "center",
        });

        // Clean up temp file
        fs.unlinkSync(file.path);
      }

      doc.end();
      const pdfBuffer = await pdfPromise;

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="images.pdf"',
        "Content-Length": pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      console.error("PDF creation error:", error);
      res.status(500).json({ error: "Failed to create PDF" });
    }
  }
);

// Convert PDF to Images
app.post(
  "/pdf-to-images",
  authenticateUser,
  uploadPdf.single("pdf"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded" });
      }

      const { format = "png", quality = "high" } = req.body;
      const pdfPath = req.file.path;
      const outputDir = path.join(__dirname, "temp_pdf_images");

      // Create temp directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      // PDF to image conversion options
      const options = {
        format: format.toLowerCase(),
        out_dir: outputDir,
        out_prefix: "page",
        page: null, // Convert all pages
      };

      // Convert PDF to images
      const imageFiles = await pdf.convert(pdfPath, options);

      if (!imageFiles || imageFiles.length === 0) {
        throw new Error("No pages found in PDF");
      }

      const zip = new JSZip();
      const convertedFiles = [];

      // Process each page image
      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = path.join(outputDir, `page-${i + 1}.${format}`);

        if (fs.existsSync(imagePath)) {
          let imageBuffer = fs.readFileSync(imagePath);

          // Apply quality settings if needed
          if (format === "jpeg" || format === "jpg") {
            const qualityValue =
              quality === "high" ? 90 : quality === "medium" ? 70 : 50;
            imageBuffer = await sharp(imageBuffer)
              .jpeg({ quality: qualityValue })
              .toBuffer();
          } else if (format === "png" && quality !== "high") {
            const compressionLevel = quality === "low" ? 6 : 4;
            imageBuffer = await sharp(imageBuffer)
              .png({ compressionLevel })
              .toBuffer();
          }

          const filename = `page_${i + 1}.${format}`;
          zip.file(filename, imageBuffer);

          convertedFiles.push({
            page: i + 1,
            filename: filename,
            size: imageBuffer.length,
          });

          // Clean up temp file
          fs.unlinkSync(imagePath);
        }
      }

      // Clean up PDF and temp directory
      fs.unlinkSync(pdfPath);
      if (fs.existsSync(outputDir)) {
        fs.rmdirSync(outputDir);
      }

      // Generate ZIP
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="pdf_pages.zip"`,
        "Content-Length": zipBuffer.length,
      });

      res.send(zipBuffer);
    } catch (error) {
      console.error("PDF to images error:", error);

      // Clean up on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ error: "PDF conversion failed" });
    }
  }
);

// Watermark Remover (AI-free approach using blur detection)
app.post(
  "/remove-watermark",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const inputPath = req.file.path;
      const originalName = path.parse(req.file.originalname).name;
      const outputFilename = `${originalName}_watermark_removed.png`;
      const outputPath = path.join("uploads", outputFilename);

      // Simple watermark removal using image processing techniques
      await sharp(inputPath)
        .modulate({ brightness: 1.1, saturation: 1.2 }) // Enhance image
        .sharpen() // Sharpen details
        .png({ quality: 100 })
        .toFile(outputPath);

      // Clean up input file
      fs.unlinkSync(inputPath);

      res.json({
        success: true,
        message: "Watermark removal attempted",
        downloadUrl: `/download/${outputFilename}`,
        note: "Results may vary depending on watermark type and image quality",
      });
    } catch (error) {
      console.error("Watermark removal error:", error);
      res.status(500).json({ error: "Watermark removal failed" });
    }
  }
);

// View Image Metadata
app.post(
  "/view-metadata",
  authenticateUser,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const inputPath = req.file.path;
      const metadata = await sharp(inputPath).metadata();

      // Clean up input file
      fs.unlinkSync(inputPath);

      // Format metadata for display
      const formattedMetadata = {
        basic: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          hasProfile: metadata.hasProfile,
        },
        exif: metadata.exif
          ? {
              make: metadata.exif.image?.Make,
              model: metadata.exif.image?.Model,
              dateTime: metadata.exif.image?.DateTime,
              software: metadata.exif.image?.Software,
              orientation: metadata.exif.image?.Orientation,
              xResolution: metadata.exif.image?.XResolution,
              yResolution: metadata.exif.image?.YResolution,
              exposureTime: metadata.exif.exif?.ExposureTime,
              fNumber: metadata.exif.exif?.FNumber,
              iso: metadata.exif.exif?.ISO,
              focalLength: metadata.exif.exif?.FocalLength,
              flash: metadata.exif.exif?.Flash,
            }
          : null,
        gps: metadata.exif?.gps
          ? {
              latitude: metadata.exif.gps.GPSLatitude,
              longitude: metadata.exif.gps.GPSLongitude,
              altitude: metadata.exif.gps.GPSAltitude,
              timestamp: metadata.exif.gps.GPSTimeStamp,
            }
          : null,
      };

      res.json({
        success: true,
        metadata: formattedMetadata,
      });
    } catch (error) {
      console.error("Metadata view error:", error);
      res.status(500).json({ error: "Failed to read metadata" });
    }
  }
);

// Admin User Management
app.get("/admin/users", authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Ban/Unban User
app.post("/admin/users/:username/ban", authenticateAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const { action } = req.body; // 'ban' or 'unban'

    const status = action === "ban" ? "banned" : "active";

    await User.findOneAndUpdate({ username }, { status });

    res.json({
      success: true,
      message: `User ${action}ned successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// Delete User
app.delete("/admin/users/:username", authenticateAdmin, async (req, res) => {
  try {
    const { username } = req.params;

    // Delete user and their data
    await User.findOneAndDelete({ username });
    await Conversion.deleteMany({ userId: username });
    await ApiUsage.deleteMany({ userId: username });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// API Usage Monitoring
app.get("/admin/api-usage", authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const usage = await ApiUsage.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ApiUsage.countDocuments();

    // Usage statistics
    const stats = await ApiUsage.aggregate([
      {
        $group: {
          _id: "$endpoint",
          count: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      usage,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch API usage" });
  }
});

// Delete Conversion Logs
app.delete("/admin/logs/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await Conversion.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Log deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete log" });
  }
});

// Bulk Delete Logs
app.delete("/admin/logs", authenticateAdmin, async (req, res) => {
  try {
    const { days } = req.body; // Delete logs older than X days

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days || 30));

    const result = await Conversion.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} logs`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete logs" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

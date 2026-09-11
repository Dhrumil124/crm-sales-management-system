const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../storage/attachments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage for real multipart file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `att-${uniqueSuffix}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Dual middleware: parses multipart if Content-Type starts with multipart/form-data;
// otherwise gracefully passes JSON bodies through for automated test metadata.
const ticketAttachmentUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const singleUpload = upload.single("file");
    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File size exceeds 10MB limit" });
          }
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || "Failed to process uploaded file" });
      }
      next();
    });
  } else {
    next();
  }
};

module.exports = {
  ticketAttachmentUpload,
  uploadDir
};

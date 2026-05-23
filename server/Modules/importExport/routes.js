const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const verifyToken = require("../../middleware/verifyToken");
const checkOrganization = require("../../middleware/checkOrganization");
const Controller = require("./controller");
const {
  MAX_IMPORT_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} = require("./constants");

const router = express.Router();

const importUploadDir = path.join(__dirname, "../../uploads/imports");
if (!fs.existsSync(importUploadDir)) {
  fs.mkdirSync(importUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, importUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const name = path.basename(file.originalname || "import", ext).replace(/\s+/g, "-");
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMPORT_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error("Only CSV and Excel files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const handleImportUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: false,
        message: "File too large. Maximum allowed size is 25MB",
      });
    }
    return res.status(400).json({
      status: false,
      message: err.message || "Upload error",
    });
  });
};

router.post(
  "/import/:entity",
  verifyToken,
  checkOrganization,
  handleImportUpload,
  Controller.importData
);

router.get(
  "/export/:entity",
  verifyToken,
  checkOrganization,
  Controller.exportData
);

module.exports = router;

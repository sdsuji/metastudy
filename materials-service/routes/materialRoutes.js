const express = require("express");
const multer = require("multer");
const materialController = require("../controllers/materialController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
// Use memory storage to handle the file buffer before uploading to S3
const upload = multer({ storage: multer.memoryStorage() });

// Upload file
router.post("/upload", verifyToken, upload.single("file"), materialController.uploadMaterial);

// Add link
router.post("/link", verifyToken, materialController.createLinkMaterial);

// Get materials for a class
router.get("/class/:classId", verifyToken, materialController.getMaterialsByClass);

// Get signed URL for view/download
router.get("/:id/signed-url", verifyToken, materialController.getSignedUrl);

// Update material (existing route, only for title/link URL updates)
router.put("/:id", verifyToken, materialController.updateMaterial);

// 👈 NEW ROUTE: Replace material file (for file materials)
router.put("/:id/replace-file", verifyToken, upload.single("newFile"), materialController.replaceFile);

// Delete material
router.delete("/:id", verifyToken, materialController.deleteMaterial);

module.exports = router;
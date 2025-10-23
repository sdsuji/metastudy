const express = require("express");
const multer = require("multer");
const assignmentController = require("../controllers/assignmentController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", verifyToken, upload.single("file"), assignmentController.uploadAssignment);
router.get("/class/:classId", verifyToken, assignmentController.getAssignmentsByClass);
router.get("/:id/signed-url", verifyToken, assignmentController.getSignedUrl);
router.delete("/:id", verifyToken, assignmentController.deleteAssignment);
// MODIFIED: Added upload.single("file") to handle file replacement during update
router.patch("/:id", verifyToken, upload.single("file"), assignmentController.updateAssignment);

module.exports = router;

const express = require("express");
const multer = require("multer");
const submissionController = require("../controllers/submissionController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", verifyToken, upload.single("file"), submissionController.uploadSubmission);
router.get("/assignment/:assignmentId", verifyToken, submissionController.getSubmissions);
router.get("/:id/signed-url", verifyToken, submissionController.getSignedUrl);
router.delete("/:id", verifyToken, submissionController.deleteSubmission);
router.patch("/:id/grade", verifyToken, submissionController.gradeSubmission);

module.exports = router;

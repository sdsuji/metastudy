const express = require("express");
const multer = require("multer");
const submissionController = require("../controllers/submissionController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", verifyToken, upload.single("file"), submissionController.uploadSubmission);

// NEW ROUTE: Get the logged-in student's latest submission status for a specific test
router.get("/test/:testId/my/latest", verifyToken, submissionController.getLatestStudentSubmission); 

// Existing route (fetches all submissions for a test, used by teacher and student list)
router.get("/test/:testId", verifyToken, submissionController.getSubmissions);

router.get("/:id/signed-url", verifyToken, submissionController.getSignedUrl);
router.patch("/:id/grade", verifyToken, submissionController.gradeSubmission);

module.exports = router;
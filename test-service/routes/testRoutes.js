const express = require("express");
const multer = require("multer");
const testController = require("../controllers/testController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
    "/create", 
    verifyToken, 
    upload.fields([
        { name: 'questionFile', maxCount: 1 }, 
        { name: 'solutionFile', maxCount: 1 }
    ]), 
    testController.createTest
);
router.patch(
    "/:id", 
    verifyToken, 
    upload.fields([{ name: 'questionFile', maxCount: 1 }]), 
    testController.updateTest
);
router.get("/class/:classId", verifyToken, testController.getTestsByClass);
router.get("/:id/signed-url", verifyToken, testController.getSignedUrl);
router.patch("/:id", verifyToken, testController.updateTest);
router.delete("/:id", verifyToken, testController.deleteTest);

module.exports = router;
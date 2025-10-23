const Material = require("../models/Material");
const s3Client = require("../config/s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Upload file (teacher only)
exports.uploadMaterial = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can upload materials" });

  try {
    const { classId, title } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ msg: "No file provided" });

    const key = `${Date.now()}-${file.originalname}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();

    const material = new Material({
      classId,
      uploader: req.user.id,
      title: title || file.originalname,
      originalName: file.originalname,
      fileType: file.mimetype,
      fileId: key,
      size: file.size,
      isLink: false,
    });

    await material.save();
    res.status(201).json({ material });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Upload failed", error: err.message });
  }
};

// Add link (teacher only)
exports.createLinkMaterial = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can add links" });

  try {
    const { classId, title, url } = req.body;
    if (!classId || !url) return res.status(400).json({ msg: "Missing fields" });

    const material = new Material({
      classId,
      uploader: req.user.id,
      title,
      isLink: true,
      linkUrl: url,
      size: 0,
    });

    await material.save();
    res.status(201).json({ material });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to create link", error: err.message });
  }
};

// Get materials for a class
exports.getMaterialsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const materials = await Material.find({ classId }).sort({ uploadedAt: -1 });
    res.json({ materials });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch materials", error: err.message });
  }
};

// Get signed URL for view/download
exports.getSignedUrl = async (req, res) => {
  const { id } = req.params;
  const { action } = req.query; // 'view' or 'download'

  try {
    const mat = await Material.findById(id);
    if (!mat) return res.status(404).json({ msg: "Material not found" });
    if (mat.isLink) return res.json({ url: mat.linkUrl });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: mat.fileId,
      ResponseContentDisposition:
        action === "download"
          ? `attachment; filename="${mat.originalName.replace(/"/g, "")}"`
          : `inline; filename="${mat.originalName.replace(/"/g, "")}"`,
      ResponseContentType: mat.fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    res.json({ url: signedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to get signed URL", error: err.message });
  }
};

// Update material (teacher only) - Only updates title/linkUrl
exports.updateMaterial = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can update materials" });

  try {
    const { id } = req.params;
    const { title, linkUrl } = req.body;

    // 1. Find the material
    const material = await Material.findById(id);
    if (!material) return res.status(404).json({ msg: "Material not found" });

    // 2. Update fields
    if (title !== undefined) {
      material.title = title.trim();
    }

    if (material.isLink) {
      if (linkUrl !== undefined) {
        material.linkUrl = linkUrl.trim();
      }
    } else if (linkUrl !== undefined) {
      // Prevent accidental linkUrl update on a file material
      return res.status(400).json({ msg: "Cannot update link URL on a file material." });
    }

    // 3. Save the updated material
    await material.save();

    res.json({ msg: "Material updated successfully", material });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update material", error: err.message });
  }
};

// 👈 NEW CONTROLLER: Replace material file (teacher only)
exports.replaceFile = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can replace files" });

  try {
    const { id } = req.params;
    const { title } = req.body;
    // req.file is the new file uploaded under the field name 'newFile'
    const newFile = req.file; 

    if (!newFile) return res.status(400).json({ msg: "No file provided for replacement" });

    const material = await Material.findById(id);
    if (!material) return res.status(404).json({ msg: "Material not found" });
    if (material.isLink) return res.status(400).json({ msg: "Cannot replace file on a link material" });

    // 1. Delete the old file from S3
    if (material.fileId) {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: material.fileId })
      );
    }

    // 2. Upload the new file to S3
    const newKey = `${Date.now()}-${newFile.originalname}`;
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: newKey,
        Body: newFile.buffer,
        ContentType: newFile.mimetype,
      },
    });
    await upload.done();

    // 3. Update the material document in MongoDB
    // Title is optional, only update if provided/changed
    if (title !== undefined) {
      material.title = title.trim();
    }
    
    material.originalName = newFile.originalname;
    material.fileType = newFile.mimetype;
    material.fileId = newKey; // Store the new S3 key
    material.size = newFile.size;
    material.uploadedAt = Date.now(); // Update timestamp

    await material.save();
    res.json({ msg: "File replaced successfully", material });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "File replacement failed", error: err.message });
  }
};

// Delete material (teacher only)
exports.deleteMaterial = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can delete materials" });

  try {
    const mat = await Material.findById(req.params.id);
    if (!mat) return res.status(404).json({ msg: "Material not found" });

    if (!mat.isLink && mat.fileId) {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: mat.fileId })
      );
    }

    await mat.deleteOne();
    res.json({ msg: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to delete material", error: err.message });
  }
};
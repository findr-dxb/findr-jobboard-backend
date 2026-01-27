const express = require("express");
const router = express.Router();
const multer = require("multer");
const supabase = require("../config/supabase");
const crypto = require("crypto");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Bucket name for Supabase storage
const BUCKET_NAME = "findr-uploads";

// Helper function to ensure bucket exists
async function ensureBucketExists() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return false;
    }

    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: null // Allow all file types
      });

      if (createError) {
        console.error("Error creating bucket:", createError);
        console.warn(`Please create the bucket "${BUCKET_NAME}" manually in Supabase dashboard`);
        return false;
      }

      console.log(`Bucket "${BUCKET_NAME}" created successfully`);
    }

    return true;
  } catch (error) {
    console.error("Error ensuring bucket exists:", error);
    return false;
  }
}

// Initialize bucket on module load (non-blocking)
ensureBucketExists().catch(err => {
  console.warn("Bucket initialization warning:", err.message);
});

// Helper function to get file extension
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// Helper function to determine resource type from MIME type
function getResourceType(mimetype) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "raw";
}

// Helper function to upload file to Supabase
async function uploadToSupabase(buffer, filename, folder, mimetype) {
  try {
    // Ensure bucket exists before uploading
    const bucketExists = await ensureBucketExists();
    if (!bucketExists) {
      throw new Error(`Bucket "${BUCKET_NAME}" does not exist. Please create it in Supabase dashboard.`);
    }

    // Generate unique filename
    const fileExt = getFileExtension(filename);
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const uniqueFilename = `${uniqueId}${fileExt}`;
    const filePath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      // Handle specific Supabase errors
      if (error.message?.includes("Bucket not found")) {
        throw new Error(`Bucket "${BUCKET_NAME}" not found. Please create it in Supabase dashboard.`);
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Format response to match Cloudinary format (for frontend compatibility)
    const resourceType = getResourceType(mimetype);
    const format = fileExt.replace(".", "").toLowerCase();

    return {
      url: urlData.publicUrl,
      secure_url: urlData.publicUrl,
      public_id: filePath,
      original_filename: filename,
      format: format,
      resource_type: resourceType,
      bytes: buffer.length,
    };
  } catch (error) {
    console.error("Supabase upload error:", error);
    throw error;
  }
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const folder = req.body.folder || "findr_uploads";
    const result = await uploadToSupabase(
      req.file.buffer,
      req.file.originalname,
      folder,
      req.file.mimetype
    );

    res.json({
      message: "Upload successful",
      data: result,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ 
      message: "Upload failed", 
      error: error.message || "Unknown error" 
    });
  }
});

router.post("/upload-raw", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const folder = "findr_uploads";
    const result = await uploadToSupabase(
      req.file.buffer,
      req.file.originalname,
      folder,
      req.file.mimetype
    );

    res.json({
      message: "Upload successful",
      data: result,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ 
      message: "Upload failed", 
      error: error.message || "Unknown error" 
    });
  }
});

module.exports = router;

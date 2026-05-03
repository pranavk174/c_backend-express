import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /start-upload
// Creates a temp folder for chunks and returns an uploadId
export const start = async (req, res) => {
  try {
    const uploadId = crypto.randomUUID();
    await fs.mkdir(`upload/${uploadId}`, { recursive: true });
    return res.status(201).json({ uploadId, chunkSize: 1024 * 1024 });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to start upload" });
  }
};

// POST /upload-chunk
// Saves a single chunk to the temp folder
// Body: { uploadId, index }  |  File: chunk (multipart)
export const uploadChunk = async (req, res) => {
  try {
    const { uploadId, index } = req.body;
    const file = req.file;

    if (!uploadId || index === undefined || !file) {
      return res
        .status(400)
        .json({ message: "Missing fields", success: false });
    }

    const dirPath = path.join("upload", uploadId);

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    await fs.writeFile(path.join(dirPath, String(index)), file.buffer);

    return res.status(201).json({ message: "Chunk uploaded", success: true });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Chunk upload failed", success: false });
  }
};

// POST /finish-upload
// Merges all chunks, uploads to Cloudinary, cleans up temp files
// Body: { uploadId, extension }
export const finishUpload = async (req, res) => {
  const { uploadId, extension } = req.body;

  if (!uploadId || !extension) {
    return res.status(400).json({ message: "Missing uploadId or extension" });
  }

  const folderPath = `upload/${uploadId}`;
  const finalPath = `upload/${uploadId}-${Date.now()}.${extension}`;

  try {
    const parts = await fs.readdir(folderPath);

    if (!parts.length) {
      return res.status(400).json({ message: "No chunks found" });
    }

    // merge chunks in order
    const finalFile = await fs.open(finalPath, "w");
    for (const p of parts.sort((a, b) => Number(a) - Number(b))) {
      const buf = await fs.readFile(path.join(folderPath, p));
      await finalFile.write(buf);
    }
    await finalFile.close();

    // upload merged file to Cloudinary
    const result = await cloudinary.uploader.upload(finalPath, {
      folder: "uploads",
      resource_type: "auto",
    });

    // cleanup temp folder and merged file
    await fs.rm(folderPath, { recursive: true, force: true });
    await fs.unlink(finalPath);

    return res.status(200).json({
      success: true,
      fileUrl: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Finish upload failed" });
  }
};

// POST /cancel-upload
// Deletes the temp folder for a given uploadId
// Body: { uploadId }
export const cancel = async (req, res) => {
  const { uploadId } = req.body;

  if (!uploadId) {
    return res.status(400).json({ message: "Missing uploadId" });
  }

  try {
    await fs.rm(`upload/${uploadId}`, { recursive: true, force: true });
    return res.status(200).json({ message: "Upload cancelled" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Cancel failed" });
  }
};

// this api is simple srf upload krke string de deta hai , ooper wale se iska koi lena dena nhi hai.
export const fileUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No file provided", success: false });
    }

    console.log(req.file, "file data..");

    // upload buffer directly to cloudinary using upload_stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "uploads", resource_type: "auto" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    console.log(result, "resu;lt.....");

    return res.status(200).json({
      success: true,
      fileUrl: result.secure_url,
      public_id: result.public_id,
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "File upload failed", success: false });
  }
};

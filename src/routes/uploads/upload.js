import express from "express";
import multer from "multer";
import { start, uploadChunk, finishUpload, cancel } from "../../controller/Upload/controller.js";
import { fileUpload } from "../../controller/Upload/controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/start-upload", start);
router.post("/upload-chunk", upload.single("chunk"), uploadChunk);
router.post("/finish-upload", finishUpload);
router.post("/cancel-upload", cancel);
router.post("/file-upload", upload.single("file"), fileUpload);


export default router;

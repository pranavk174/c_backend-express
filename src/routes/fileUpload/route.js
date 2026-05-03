import express from "express";
import multer from "multer";
import { fileUpload } from "../../controller/FileUpload/controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), fileUpload);

export default router;

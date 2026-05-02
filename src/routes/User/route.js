import express from "express";
const router = express.Router();
import { sendOtpEmail, verifyOtp } from "../../controller/User/controller.js";
router.post("/register", sendOtpEmail);
router.post("/verify", verifyOtp);

export default router;

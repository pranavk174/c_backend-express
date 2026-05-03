import express from "express";
import mediaRoute from "./uploads/upload.js";
import userRoute from "./User/route.js";

const router = express.Router();

router.use("/user", userRoute);
router.use("/media", mediaRoute);

export default router;

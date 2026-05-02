import "dotenv/config";
import express from "express";
import router from "./routes/User/route.js";
const app = express();
app.use(express.json());
app.use("/api/v1", router);
app.listen(3000, () => {
  console.log("server startedddd.....");
});

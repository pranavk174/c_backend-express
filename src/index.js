import "dotenv/config";
import { yoga } from "./graphql/endpoints.js";
import express from "express";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import cors from "cors";
// import { authMiddleware } from "./middlewares/auth.js";
const app = express();

app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/v1", router);
app.use("/graphql", yoga);

// app.use("/api/v1", router);
app.listen(3000, () => {
  console.log("server startedddd.....");
});

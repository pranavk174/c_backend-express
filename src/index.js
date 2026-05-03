import "dotenv/config";
import { yoga } from "./graphql/endpoints.js";
import express from "express"
import router from "./routes/route.js";
const app = express();
app.use(express.json());
app.use("/graphql", yoga);
app.use("/api/v1",router)
// app.use("/api/v1", router);
app.listen(3000, () => {
  console.log("server startedddd.....");
});

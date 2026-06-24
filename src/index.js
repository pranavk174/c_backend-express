import "dotenv/config";
import { yoga } from "./graphql/endpoints.js";
// import { Server } from "socket.io";
import express from "express";

import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import cors from "cors";

// import http from "http";

import { socketAthMiddleware } from "./middlewares/auth.js";
import { chatSockets } from "./Sockets/chatNameSpaces.js";
import { allowedOrigins } from "./lib/helpers.js";
import { socketServer } from "./Sockets/Socketserver.js";
import { notificationSocketIds } from "./utils/socket.helper.js";
// import { authMiddleware } from "./middlewares/auth.js";
const app = express();
// const server = http.createServer(app);

export const { io, server } = socketServer(app);
app.use(cookieParser());

app.use(
  cors({
    origin: (origin, callback) => {
      // mobile apps/postman/server-side requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // callback(new Error("CORS not allowed"));
        callback(null, true);
      }
    },

    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/v1", router);
app.use("/graphql", yoga);

// io.use(socketAthMiddleware);

export const chatNamespace = io.of("/chat");
export const notificationNamespace = io.of("/notification");

chatNamespace.use(socketAthMiddleware);
notificationNamespace.use(socketAthMiddleware);

chatNamespace.on("connection", chatSockets);

notificationNamespace.on("connection", (socket) => {
  const payload = socket.user;
  notificationSocketIds.set(payload.userId.toString(), socket.id);
  socket.join(`user:${socket.user._id}`);
  console.log("notification connected", socket.id);
});

server.listen(3000, () => {
  console.log("Server + Socket.IO started on port 3000");
});

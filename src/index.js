import "dotenv/config";
import "./cron.js";
import "./cronjobs/dbcleaner.js"
import { yoga } from "./graphql/endpoints.js";
// import { Server } from "socket.io";
import express from "express";
import { logger } from "./utils/logger.js";
import prisma from "../prisma/prisma-client.js";
import cookieParser from "cookie-parser";
import cors from "cors";

// import http from "http";

import { socketAuthMiddleware } from "./middlewares/auth.js";
import { chatSockets } from "./Sockets/chatNameSpaces.js";
import { allowedOrigins } from "./lib/helpers.js";
import { socketServer } from "./Sockets/Socketserver.js";
import { notificationSocketIds } from "./utils/socket.helper.js";
import { NotificationSocket } from "./Sockets/NotificationsNamespace.js";
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

// io.use(socketAuthMiddleware);

export const chatNamespace = io.of("/chat");
export const notificationNamespace = io.of("/notification");

chatNamespace.use(socketAuthMiddleware);
notificationNamespace.use(socketAuthMiddleware);

chatNamespace.on("connection", chatSockets);

notificationNamespace.on("connection", NotificationSocket);

app.get("/health", async (req, res) => {
  try {
    // Agar DB check karna ho
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({
      status: "error",
    });
  }
});

app.use("/graphql", yoga);
server.listen(process.env.PORT, () => {
  logger.debug("Server + Socket.IO started on port:", process.env.PORT);
});

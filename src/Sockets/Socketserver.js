import { Server } from "socket.io";

import http from "http";
import { allowedOrigins } from "../lib/helpers.js";

export const socketServer = (app) => {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Postman/mobile apps/no-origin requests
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("CORS not allowed"));
        }
      },

      methods: ["GET", "POST"],

      credentials: true,
    },
  });
  return { server, io };
};

// export const chatNamespace = io.of("/chat");
// export const notificationNamespace = io.of("/notification");

// chatNamespace.use(socketAuthMiddleware);
// notificationNamespace.use(socketAuthMiddleware);

// chatNamespace.on("connection", chatSockets);

// notificationNamespace.on("connection", (socket) => {
//   console.log("notification connected", socket.id);
// });

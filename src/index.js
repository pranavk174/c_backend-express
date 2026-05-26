import "dotenv/config";
import { yoga } from "./graphql/endpoints.js";
import { Server } from "socket.io";
import express from "express";
import prisma from "../prisma/prisma-client.js";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { sendUsers } from "./utils/socket.helper.js";
import http from "http";
import {
  CHAT_JOINED,
  CHAT_LEAVED,
  ERROR,
  NEW_MESSAGE,
  MESSAGE_REACTION,
  REFETCH_CHATS,
  REPLY_MESSAGE,
  SEND_MESSAGE,
  ONLINE_USERS,
  MESSAGE_SEEN,
} from "./utils/events.js";
import cookie from "cookie";
import { validateCookie } from "./lib/tokenvalidator.js";
import { checkMessageExists } from "./lib/helpers.js";
import {
  getSocketmembers,
  getSockets,
  joinChat,
  leaveChat,
  onlineUsers,
  userSocketIDs,
} from "./utils/socket.helper.js";
import {
  reactMessage,
  replyMessage,
  seenMessage,
  sendMessage,
} from "./controller/Socket/controller.js";
// import { authMiddleware } from "./middlewares/auth.js";
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001",
    credentials: true,
  },
});

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

io.use(async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");

    const token = cookies.accessToken;
    // console.log(token, "token dataa..", cookies);

    const payload = await validateCookie(token);

    socket.user = payload;

    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
});

// app.use("/api/v1", router);
io.on("connection", (socket) => {
  // console.log("User connected:", socket.user, socket.id);
  const payload = socket.user;
  userSocketIDs.set(payload.userId.toString(), socket.id);
  onlineUsers.add(payload.userId.toString());

  sendUsers(socket);

  // console.log(userSocketIDs, "use socet idssss");
  // User ka socketId map mein store karo
  // Example event
  socket.on("message", (data) => {
    console.log("Message received:", data);

    // sab clients ko emit
    io.emit("message", data);
  });

  socket.on(SEND_MESSAGE, (data, callback) => {
    console.log(data, "new messageeeeee");

    sendMessage(io, payload, data, callback);
  });

  socket.on(CHAT_JOINED, (data) => {
    // console.log("chat joined in event user .....", data);
    const { chat_id } = data;
    joinChat(data);

    socket.join(`chat:${chat_id}`);
    // socket.join(chat_id);

    const members = getSocketmembers(payload.userId);
    console.log(members, "members....");
    socket.to(members).emit(ONLINE_USERS, Array.from(onlineUsers));
    // seenMessage(socket, payload, data);
  });

  socket.on(MESSAGE_SEEN, (data,callback) => {
    console.log("message seenbd", data);
    seenMessage(io, payload, data,callback);
  });

  socket.on(CHAT_LEAVED, (data) => {
    // console.log("chat ;eaft. user .....", data);
    const { chat_id } = data;
    leaveChat(data);
    socket.leave(`chat:${chat_id}`);
  });

  socket.on(REPLY_MESSAGE, (data, callback) => {
    console.log(data, "new reply messageeeeee");
    replyMessage(io, payload, data, callback);
  });

  socket.on(MESSAGE_REACTION, (data,callback) => {
    console.log(data, "dataaaaaaa in reaction...");

    reactMessage(io, payload, data,callback);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(payload.userId.toString());
    console.log("User disconnected:", payload.userId, socket.id, onlineUsers);
    userSocketIDs.delete(String(payload.userId));

    // socket.emit(ONLINE_USERS, Array.from(onlineUsers));
    sendUsers(io);
  });
});

// app.listen ki jagah server.listen use hoga
server.listen(3000, () => {
  console.log("Server + Socket.IO started on port 3000");
});

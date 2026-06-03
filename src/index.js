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
  STORY_REPLY,
  STORY_SEEN,
  STORY_LIKE,
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
import {
  likeStory,
  replyStory,
  seenStory,
} from "./controller/Socket/story.controller.js";
// import { authMiddleware } from "./middlewares/auth.js";
const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3001",
  "https://cfrontend-one.vercel.app",
  process.env.FRONTEND_URL,
];

export const io = new Server(server, {
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
        callback(new Error("CORS not allowed"));
      }
    },

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

    const profile_pic = await prisma.$queryRaw`
    
    select 
    
    name,
    case 
    when profile_pic is NULL then null else 
    profile_pic end as profile_pic
    
     from users where id = ${payload.userId}
    `;

    payload.profile_pic = profile_pic[0].profile_pic;
    payload.name = profile_pic[0].name;
    // console.log(payload , "middleware payloaddd")
    socket.user = payload;

    next();
  } catch (error) {
    return {
      message: error.message,
      status: 401,
      success: false,
    };
    next(new Error("Unauthorized"));
  }
});

// app.use("/api/v1", router);
io.on("connection", (socket) => {
  // console.log("User connected:", socket.user, socket.id);
  const payload = socket.user;
  userSocketIDs.set(payload.userId.toString(), socket.id);
  onlineUsers.add(payload.userId.toString());

  sendUsers(io, payload);

  console.log(userSocketIDs, "use socet idssss");
  // User ka socketId map mein store karo
  // Example event
  socket.on("message", (data) => {
    console.log("Message received:", data);

    // sab clients ko emit
    io.emit("message", data);
  });

  socket.on(SEND_MESSAGE, (data, callback) => {
    // console.log(data, "new messageeeeee");

    sendMessage(socket, payload, data, callback);
  });

  socket.on(CHAT_JOINED, (data, callback) => {
    // console.log("chat joined in event user .....", data);

    const { chat_id } = data;
    joinChat(socket, payload, data, callback);

    // const room = io.sockets.adapter.rooms;

    // // total members
    // const membersCount = room ? room.size : 0;

    // console.log("Members:", membersCount, room);
    // seenMessage(socket, payload, data);
  });

  socket.on(MESSAGE_SEEN, (data, callback) => {
    console.log("message seenbd", data, payload);
    seenMessage(socket, payload, data, callback);
  });

  socket.on(CHAT_LEAVED, (data, callback) => {
    // console.log("chat ;eaft. user .....", data);
    const { chat_id } = data;
    leaveChat(socket, data, callback);

    console.log(" socket leavedddddddd");
  });

  socket.on(REPLY_MESSAGE, (data, callback) => {
    const { chat_id } = data;
    console.log(data, "new reply messageeeeee");

    replyMessage(socket, payload, data, callback);
  });

  socket.on(MESSAGE_REACTION, (data, callback) => {
    console.log(data, "dataaaaaaa in reaction...");

    reactMessage(socket, payload, data, callback);
  });

  socket.on(STORY_REPLY, (data, callback) => {
    replyStory(socket, payload, data, callback);
  });

  socket.on(STORY_SEEN, (data, callback) => {
    seenStory(socket, payload, data, callback);
  });

  socket.on(STORY_LIKE, (data, callback) => {
    likeStory(socket, payload, data, callback);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(payload.userId.toString());
    console.log("User disconnected:", payload.userId, socket.id, onlineUsers);
    userSocketIDs.delete(String(payload.userId));

    // socket.emit(ONLINE_USERS, Array.from(onlineUsers));
    sendUsers(io, payload);
  });
});

// app.listen ki jagah server.listen use hoga
server.listen(3000, () => {
  console.log("Server + Socket.IO started on port 3000");
});

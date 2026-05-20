import "dotenv/config";
import { yoga } from "./graphql/endpoints.js";
import { Server } from "socket.io";
import express from "express";
import prisma from "../prisma/prisma-client.js";
import router from "./routes/route.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { REFETCH_CHATS, REPLY_MESSAGE, SEND_MESSAGE } from "./utils/events.js";
import cookie from "cookie";
import { validateCookie } from "./lib/tokenvalidator.js";
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
  console.log("User connected:", socket.user);

  const payload = socket.user;
  // Example event
  socket.on("message", (data) => {
    console.log("Message received:", data);

    // sab clients ko emit
    io.emit("message", data);
  });

  socket.on(SEND_MESSAGE, async (data) => {
    console.log(data, "new messageeeeee");

    const { content, media, chat_ids, reciever_ids } = data;
    if (
      (!content && !media) ||
      (chat_ids &&
        chat_ids.length < 1 &&
        reciever_ids &&
        reciever_ids.length < 1)
    ) {
      return {
        message: "Data is missing...",
        status: 400,
        success: false,
      };
    }

    // if(reciever_ids && reciever_ids.incldes(payload.userID))

    let chatId = null;
    let chat_id = null;
    if (chat_ids && chat_ids.length > 0) {
      chatId = chat_ids[0];
      chat_id = chat_ids[0];
    }

    try {
      if (!chat_id) {
        const reciever_id = parseInt(reciever_ids[0]);
        const reciever = await chekUserExists(prisma, reciever_ids);

        // console.log(typeof reciever_id, "type dataaa...");
        if (!reciever.length > 0) {
          throw new Error("Reciever Does not exists");
        }
        // const memeberExists = await checkMemeberExists(prisma, reciever_ids);

        const chatExists = await checkChatExists(
          prisma,
          payload.userId,
          reciever_ids,
        );

        if (chatExists.length < 1) {
          const data = await prisma.$queryRaw`
        
        insert into chat (chat_type) values('private')  RETURNING id;


        `;

          if (!data || data.length < 1) {
            throw new Error();
          }
          chatId = data[0].id;

          const chatmember = await prisma.$queryRaw`
        
        insert into chat_member (member_id ,chat_id ) values(${payload.userId},${chatId}),(${reciever_id},${chatId})
        
        `;
          if (!chatmember) {
            throw new Error();
          }
        }

        chatId = chatExists[0].chat_id;
      }
      const addMessage = await prisma.$queryRaw`
        
        insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},${new Date()},${chat_id ?? chatId}) returning *
        
        `;

      if (media && media.length > 0) {
        const [addMedia] = await Promise.all(
          media.map((m) => {
            return prisma.$queryRaw`

        insert into attachment (message_id,url,file_type,file_name,file_size) values(${addMessage[0].id},${m.url},${m.file_type.toLowerCase()},${m.file_name},${m.file_size}) returning *

        `;
          }),
        );

        if (!addMedia) {
          throw new Error();
        }
      }

      console.log(addMessage, "chatiddddd");

      if (!addMessage) {
        throw new Error();
      }

      socket.emit(REFETCH_CHATS, addMessage);

      // const chatData = await
    } catch (error) {
      console.log(error);
    }
  });

  socket.on(REPLY_MESSAGE, (data) => {
    console.log(data, "new reply messageeeeee");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// app.listen ki jagah server.listen use hoga
server.listen(3000, () => {
  console.log("Server + Socket.IO started on port 3000");
});

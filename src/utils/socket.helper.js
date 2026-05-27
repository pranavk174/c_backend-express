export const userSocketIDs = new Map(); // userId -> socketId
export const onlineUsers = new Set();
import prisma from "../../prisma/prisma-client.js";
import { ONLINE_USERS } from "./events.js";
export const joinChat = async (socket, data, callback) => {
  const { user_id, chat_id, chatMember } = data;
  console.log("chat joined user .....", data);
  onlineUsers.add(user_id.toString());

  const chatMembers = await prisma.$queryRaw`
  
  select member_id from chat_member where chat_id = ${chat_id}
  
  `;

  // console.log(
  //   chatMembers,
  //   "chat memebrssss",
  //   chatMembers.find((member) => member.member_id !== user_id),
  // );
  const otherUserId = chatMembers.find(
    (member) => member.member_id !== user_id,
  )?.member_id;

  const blocked = await prisma.block.findFirst({
    where: {
      blocked: true,

      OR: [
        {
          user_id: user_id,
          blocked_user_id: otherUserId,
        },
        {
          user_id: otherUserId,
          blocked_user_id: user_id,
        },
      ],
    },
  });

  if (blocked) {
    // console.log(blocked, "blockeddd suer....");
    return callback({
      message: " You can not Join this chat , User is Blocked..",
      status: 500,
      success: false,
    });
  }

  // console.log(blocked, "user joinedddd.");

  const users = socket.join(`chat:${chat_id}`);

  // console.log(users, "user joinedddddddd", socket.rooms);

  return callback({
    message: "user joined",
    data: users,
    success: true,
  });
};

export const leaveChat = (socket, data, callback) => {
  const { chat_id, user_id } = data;
  // console.log("chat ;eaft. user .....", data);

  // onlineUsers.delete(user_id.toString());
  const users = socket.leave(`chat:${chat_id}`);

  console.log("user left", socket.rooms);
  return callback({
    message: "user left",
    data: users,
    success: true,
  });
};

export const getSockets = (member) => {
  const receiverSocketId = userSocketIDs.get(String(member));
  return receiverSocketId;
};

export const getSocketmembers = (id) => {
  const data = Array.from(userSocketIDs).map((d) => d[1]);
  return data;
};

export const sendUsers = (socket, payload) => {
  // console.log("users online", payload);

  socket.emit(ONLINE_USERS, Array.from(onlineUsers));
  const members = getSocketmembers(payload.userId);
  // socket.to(members).emit(ONLINE_USERS, Array.from(onlineUsers));
  // console.log(members, "memberssss");
};

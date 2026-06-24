export const chatSocketIds = new Map();
export const notificationSocketIds = new Map();
export const storySocketIds = new Map();
export const onlineUsers = new Set();
import prisma from "../../prisma/prisma-client.js";
import { Prisma } from "@prisma/client";
import { ONLINE_USERS, SEEN_NOTIFICATION } from "./events.js";

export const checkBlocked = async (user_id, otherUserId) => {
  try {
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
      return true;
    } else {
      return false;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

export const joinChat = async (socket, payload, data, callback) => {
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

  const notifications = await prisma.$queryRaw`
  

SELECT n.*
FROM notification n
LEFT JOIN notification_seen ns
ON n.notification_id = ns.notification_id
AND ns.user_id = ${payload.userId}

WHERE n.reciever_id = ${payload.userId} and n.sender_id = ${otherUserId} and n.notification_type = 'new_message'
AND ns.notification_id IS NULL;
  
  `;

  if (notifications.length > 0) {
    const values = notifications.map(
      (no) => Prisma.sql`(${no.notification_id}, ${payload.userId})`,
    );

    const insertSeen = await prisma.$queryRaw`
  INSERT INTO notification_seen (notification_id, user_id)
  VALUES ${Prisma.join(values)}
  ON CONFLICT(notification_id, user_id)
  DO NOTHING  returning notification_id
`;

    // const seen = insertSeen.reduce((acc, idx) => {
    //   const data = idx.notification_id;

    //   console.log(data, "data in redice");
    //   // acc.push(data);
    // }, []);

    // console.log(insertSeen, "insert seen npotficationssssss...");
    socket.emit(
      SEEN_NOTIFICATION,
      insertSeen.map((seen) => seen.notification_id),
    );
  }

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
  const receiverSocketId = chatSocketIds.get(String(member));
  return receiverSocketId;
};

/**
 * Check karta hai ki receiver currently given chat room mein join kiya hua hai ya nahi.
 * @param {import("socket.io").Server} io - Socket.IO server instance
 * @param {string|number} receiverId - Receiver ka userId
 * @param {string|number} chatId - Chat room ka ID
 * @returns {boolean}
 */
export const isReceiverInRoom = (io, receiverId, chatId) => {
  const receiverSocketId = chatSocketIds.get(String(receiverId));
  if (!receiverSocketId) return false; // receiver online hi nahi hai
  console.log(io.adapter.rooms, "ada[pyerss");
  const room = io.adapter.rooms.get(`chat:${chatId}`);
  console.log(room, "room dataaaaa");
  if (!room) return false; // room exist hi nahi karti

  return room.has(receiverSocketId);
};

export const getSocketmembers = (id) => {
  const data = Array.from(chatSocketIds).map((d) => d[1]);
  return data;
};

export const sendUsers = async (socket, payload) => {
  // console.log("users online", onlineUsers, chatSocketIds);

  const users = Array.from(onlineUsers);

  console.log(users, "users ");

  // for (const friend of users) {
  //   const isBlocked = await checkBlocked(payload.userId, parseInt(friend));
  //   // console.log(isBlocked, "blocked condition....", friend);
  //   if (isBlocked) continue;

  //   const member = getSockets(friend);
  //   console.log(
  //     member,
  //     "member ",
  //     payload.name,
  //     payload.userId,
  //     Array.from(onlineUsers).filter((u) => u === friend.toString()),
  //   );
  //   const members = getSocketmembers(payload.userId);

  //   //  io.to(`user:${friend.id}`).emit("userOnline", {
  //   //     userId
  //   //  });
  //   socket.to(members.filter((m) => m != member)).emit(
  //     ONLINE_USERS,
  //     Array.from(onlineUsers).filter((u) => u === friend.toString()),
  //   );
  // }

  const members = getSocketmembers(payload.userId);
  socket.to(members).emit(ONLINE_USERS, Array.from(onlineUsers));
  console.log(members, "memberssss");
};

export const createNotification = async (
  reciever_id,
  payload,
  type,
  message,
  reference_id = null,
) => {
  try {
    const res = await prisma.$queryRaw`
      
   



      insert into notification (reciever_id,sender_id ,notification_type,metadata,reference_id) values(
        ${reciever_id},${payload.userId},${type},   ${JSON.stringify({
          message: `${message}`,
        })}::jsonb , ${reference_id}

      
      
      ) returning *
      
      
      `;

    const notification = {
      notification_id: res[0].notification_id,
      notification_type: res[0].notification_type,
      name: payload.name,
      message: res[0].metadata.message,
      time: res[0].created_at,
      reference_id: res[0].reference_id,
      profile_pic: payload.profile_pic,
      color: "#25D366",
    };

    return { notification, res };
  } catch (err) {
    throw new Error(err.message);
  }
};

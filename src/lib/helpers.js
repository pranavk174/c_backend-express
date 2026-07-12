import { chatSocketIds } from "../utils/socket.helper.js";
import { createPubSub } from "graphql-yoga";

export const checkMessageExists = async (prisma, message_ids) => {
  const data = await prisma.$queryRaw`

    SELECT id,chat_id,sender_id,is_deleted
    FROM message

    WHERE id = ANY(${message_ids})
    AND is_deleted = false

  `;

  if (data.length !== message_ids.length) {
    throw new Error("Some messages do not exist or are deleted");
  }

  return data;
};

export const chekUserExists = async (prisma, users) => {
  const data = await prisma.$queryRaw`
    
    
    select id from users where id = ANY(${users}) and account_status = 'active'
    `;
  if (data.length !== users.length) {
    throw new Error("Some Uers does nnot Exists or has been deleted");
  }

  console.log(data);

  return data;
};

export const checkMemeberExists = async (prisma, chat_id, user_id) => {
  // console.log(chat_id, user_id, "======");
  const data = await prisma.$queryRaw`

    SELECT member_id
    FROM chat_member

    WHERE chat_id = ${parseInt(chat_id)}
    AND member_id = ${user_id}

  `;

  if (data.length < 1) {
    throw new Error("You Are not the member of this chat Sorry....");
  }

  return data[0];
};

export const checkChatExists = async (prisma, user_id, members) => {
  // console.log(user_id, "===========", members);
  const data = await prisma.$queryRaw`
    

    
    SELECT chat_id
FROM chat_member

GROUP BY chat_id

HAVING
    ARRAY_AGG(DISTINCT member_id ORDER BY member_id)
    =
    ${[user_id, ...members]};
    
    `;

  return data;
};

export const getSockets = (member) => {
  const receiverSocketId = chatSocketIds.get(String(member));
  return receiverSocketId;
};

export const pubsub = createPubSub();

export const allowedOrigins = [
  "http://localhost:3001",
  "https://cfrontend-one.vercel.app",
  "https://chat-application-frontend.vercel.app",
  process.env.FRONTEND_URL,
];

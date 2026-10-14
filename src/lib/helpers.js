import { chatSocketIds } from "../utils/socket.helper.js";
import { createPubSub } from "graphql-yoga";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { AppError, BadRequestError } from "./errorHandler.js";
import { numberex, stringex } from "./regex.js";
import { asyncHandeler } from "./util.js";
export const checkMessageExists = async (prisma, message_ids) => {
  const data = await prisma.$queryRaw`

    SELECT id,chat_id,sender_id,is_deleted
    FROM message

    WHERE id = ANY(${message_ids})
    AND is_deleted = false

  `;

  logger.log(message_ids, "data length and messaged idssss", data);

  if (data.length !== message_ids.length) {
    throw new BadRequestError("Some messages do not exist or are deleted");
  }

  return data;
};

export const chekUserExists = async (prisma, users) => {
  const data = await prisma.$queryRaw`
    
    
    select id from users where id = ANY(${users}) and account_status = 'active'
    `;
  if (data.length !== users.length) {
    throw new BadRequestError("Some Uers does nnot Exists or has been deleted");
  }

  logger.debug(data);

  return data;
};

export const checkMemeberExists = async (prisma, chat_id, user_id) => {
  // logger.debug(chat_id, user_id, "======");
  const data = await prisma.$queryRaw`

    SELECT member_id
    FROM chat_member

    WHERE chat_id = ${parseInt(chat_id)}
    AND member_id = ${user_id}

  `;

  return data[0];
};

export const checkChatExists = async (prisma, user_id, members) => {
  // logger.debug(user_id, "===========", members);
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

export const createChat = asyncHandeler(
  async ({ payload, reciever_id, chat_type = "private", prisma }) => {
    if (chat_type === "group") {
      const created = await prisma.$queryRaw`
      
      insert into chat (chat_type) values('group') returning id ;
      
      `;

      const members = [
        ...reciever_id.map(
          (id) => Prisma.sql` (${created[0].id}, ${id} , 'member') `,
        ),
        Prisma.sql`  (${created[0].id} , ${payload.userId} , 'admin')
      `,
      ];

      await prisma.$queryRaw`
      insert into chat_member (chat_id , member_id , role) values ${Prisma.join(members)}
      `;

      return created;
    } else {
      const data = await prisma.$queryRaw`
          
          insert into chat (chat_type) values(${chat_type})  RETURNING id;


          `;

      const chatId = data[0].id;

      await prisma.$queryRaw`
          
          insert into chat_member (member_id ,chat_id ) values(${payload.userId},${chatId}),(${reciever_id},${chatId})
          
          `;

      return chatId;
    }
  },
);

export const chekOTP = async (otp, record) => {
  if (!record) {
    throw new AppError({
      message: "OTP not found",
      status: 404,
      code: "OTP_ERROR",
    });
  }
  const isMatch = await bcrypt.compare(String(otp), record.otp);
  if (!isMatch) {
    throw new AppError({
      message: "Invalid OTP",
      status: 400,
      code: "OTP_ERROR",
    });
    // throw new Error("Invalid Otp");
  }

  const isExpired = new Date(record.expires_at) < new Date();
  if (isExpired) {
    throw new AppError({
      message: "Expired OTP",
      status: 400,
      code: "OTP_ERROR",
    });
  }
  return true;
};

export const getSockets = (member) => {
  const receiverSocketId = chatSocketIds.get(String(member));
  return receiverSocketId;
};

export const pubsub = createPubSub();

export const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:3000",
  "https://cfrontend-one.vercel.app",
  "https://chat-application-frontend.vercel.app",
  process.env.FRONTEND_URL,
];

import prisma from "../../../prisma/prisma-client.js";
import { validateToken } from "../../lib/tokenvalidator.js";

const chatResolver = {
  ChatResponse: {
    __resolveType(obj) {
      return obj._responseType;
    },
  },
  Query: {
    getChatById: async (_, { chat_id }, ctx) => {
      // console.log(ctx, "ctxx dataa..")
      const payload = await validateToken(ctx);
      if (!payload.userId) {
        throw new Error("Unauthorized User");
      }
      if (!chat_id) {
        return {
          message: "Chat Id is missing!",
          status: 404,
          success: false,
        };
      }

      try {
        const chats = await prisma.$queryRaw`
      SELECT 
   m.* ,
    sm.user_id as seen_users
FROM message m
LEFT JOIN seen_message sm 
ON m.id = sm.message_id
WHERE m.chat_id = ${chat_id};
        `;

        console.log(chats, "chat dataaa....")

        if (!chats) {
          throw new Error();
        }
        return {
          message: "Successfully retrieved Chat",
          status: 200,
          success: true,
          data: {

            _responseType: "SingleChat",
            items: chats,
          },
        };
      } catch (err) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          errr: err.message,
        };
      }
    },
    getAllChats: async (_, __, ctx) => {

      const payload = await validateToken(ctx)
      if (!payload.userId) {
        throw new Error('Unauthorized')

      }
      try {
        const chats = await prisma.$queryRaw`

SELECT 
    c.id AS chat_id,
    c.chat_type,

    u.id AS user_id,
    u.name,
    u.profile_pic,

    m.id AS last_message_id,
    m.content AS last_message,
    m.created_at AS last_message_at

FROM chat c

JOIN chat_member cm
    ON cm.chat_id = c.id

JOIN users u
    ON u.id = cm.member_id

LEFT JOIN LATERAL (
    SELECT *
    FROM message
    WHERE message.chat_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true

WHERE c.id IN (
    SELECT chat_id
    FROM chat_member
    WHERE member_id = ${payload.userId}
)

AND u.id != ${payload.userId}

ORDER BY m.created_at DESC NULLS LAST;

`;

        console.log(chats, "chatsssssss")

        if (!chats) {
          throw new Error();
        }
        return {
          message: "Successfully retrieved Chat",
          status: 200,
          success: true,
          data: {

            _responseType: 'AllChats',
            items: chats
          },
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          error: error.message,
          success: false
        }
      }

    }
  },
  Mutation: {
    sendMessage: async (_, { chat_id, user_id, content }, ctx) => {
      const payload = await validateToken(ctx)

      if (!payload.userId) {
        throw new Error("Unaithorized User")
      }

      if (!content || user_id) {
        return {
          message: "Data is missing...",
          status: 400,
          succes: false
        }
      }

      try {
        const reciever = await prisma.$queryRaw`
        select id from users where id = ${user_id}
        
        `

        if (!reciever) {
          throw new Error("Reciever Does not exists")
        }

        if (chat_id !== null) {
          const addMessage = await prisma.$queryRaw`
          
          insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},)
          
          `
        }

        // const chatData = await 

      } catch (error) {

      }
    }
  }
};

export default chatResolver
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
      const payload = ctx.user;

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

        console.log(chats, "chat dataaa....");

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
      const payload = ctx.user;

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

        console.log(chats, "chatsssssss");

        if (!chats) {
          throw new Error();
        }
        return {
          message: "Successfully retrieved Chat",
          status: 200,
          success: true,
          data: {
            _responseType: "AllChats",
            items: chats,
          },
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          error: error.message,
          success: false,
        };
      }
    },
  },
  Mutation: {
    sendMessage: async (
      _,
      { input: { chat_id, reciever_id, content = null, media } },
      ctx,
    ) => {
      const payload = ctx.user;

      let chatId = chat_id;

      if ((!content && !media) || !reciever_id) {
        return {
          message: "Data is missing...",
          status: 400,
          success: false,
        };
      }

      try {
        const reciever = await prisma.$queryRaw`
        select id from users where id = ${reciever_id} 
        
        `;

        if (!reciever) {
          throw new Error("Reciever Does not exists");
        }

        if (!chat_id) {
          chatId = await prisma.$queryRaw`
          
          insert into chat (chat_type) values('private')  RETURNING id;


          `;

          console.log(chatId, "chatiddddd==================");
          if (!chatId) {
            throw new Error();
          }
          const chatmember = await prisma.$queryRaw`
          
          insert into chat_member (member_id ,chat_id ) values(${payload.userId},${chatId[0].id}),(${reciever_id},${chatId[0].id})
          
          `;
          if (!chatmember) {
            throw new Error();
          }
        }
        const addMessage = await prisma.$queryRaw`
          
          insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},${new Date()},${chat_id ?? chatId[0].id}) returning id
          
          `;

        if (media.length > 0) {
          const [addMedia] = await Promise.all(
            media.map((m) => {
              return prisma.$queryRaw`

          insert into attachment (message_id,url,file_type,file_name,file_size) values(${addMessage[0].id},${m.url},${m.file_type.toLowerCase()},${m.file_name},${m.file_size})

          `;
            }),
          );

          if (!addMedia) {
            throw new Error();
          }
        }

        console.log(chatId, "chatiddddd");

        if (!addMessage) {
          throw new Error();
        }

        return {
          message: "Message sent successfully",
          status: 201,
          success: true,
        };

        // const chatData = await
      } catch (error) {
        console.log(error);
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
  },
};

export default chatResolver;

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
      m.id,
    
    CASE 
        WHEN m.is_deleted = true THEN 'Deleted message'
        ELSE m.content
    END AS content,

    m.chat_id,
    m.sender_id,
    m.created_at,
    m.is_forwarded,
    m.is_edited,
    m.is_deleted,
    m.reply_to_message_id as reply_to_message,
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
        console.log(err)
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    getAllChats: async (_, __, ctx) => {
      const payload = ctx.user;

      try {
        const chats = await prisma.$queryRaw`

SELECT 
  distinct  (c.id) AS chat_id,
    c.chat_type,

    u.id AS user_id,
    u.name,
    u.profile_pic,

    m.id AS last_message_id,
      CASE 
        WHEN m.content IS NULL THEN a.file_type :: text
        ELSE m.content
    END AS last_message,
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
    AND is_deleted = false
    ORDER BY created_at DESC
    LIMIT 1
) m ON true

LEFT JOIN attachment a
    ON a.message_id = m.id AND m.content IS NULL

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

      if ((!content && !media) || (!chat_id && !reciever_id)) {
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
    editMessage: async (_, { input: { message_id, content } }, ctx) => {

      const payload = ctx.user

      if (!message_id || !content) {
        return {
          message: "Data is missing", success: false, status: 400
        }
      }
      try {

        const messageData = await prisma.$queryRaw`
        
        select id,content from message where id = ${message_id} and is_deleted = false limit 1
        
        `

        console.log(messageData, "message dataaa.")

        if (messageData.length < 1) {
          throw new Error("This message does not exist or has been deleted")
        }

        const [editMessage, updateMessage] = await Promise.all(
          [prisma.$queryRaw`

          insert into edit_message (message_id ,content ,old_content) values(${message_id},${content},${messageData[0].content})

          `,
          prisma.$queryRaw`

UPDATE message
SET 
    content = ${content},
    is_edited = true
WHERE id = ${message_id}

`
          ])


        if (!editMessage || !updateMessage) {
          throw new Error("Error in Updating")
        }

        return {
          message: "Message Edited successfully",
          status: 201,
          success: true,
        };







      } catch (err) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: err.message
        };
      }
    },
    deleteMessage: async (_, { message_id }, ctx) => {

      const payload = ctx.user

      if (!message_id) {

        return {
          message: "Message Id is Missing", status: 400, success: false
        }
      }

      try {

        const messageData = await prisma.$queryRaw`
        
        select id from message where id = ${message_id}`


        if (messageData.length < 1) {
          throw new Error("This Message doest not Exists or  is Already deleted")
        }

        const deleted = await prisma.$queryRaw`
        

        update message set is_deleted = true 
        where id = ${message_id} ;

        `


        if (!deleted) {
          throw new Error("Message not deleted..")
        }





      } catch (error) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message
        };
      }
    },
    replyMessage: async (_, { input: { message_id, content, media } }, ctx) => {

      const payload = ctx.user

      if (!message_id || (!content && !media)) {
        return {
          message: "Data is Missing",
          status: 400,
          success: false
        }
      }


      try {

        const messageData = await prisma.$queryRaw`
        
        select chat_id,id from message where id = ${message_id} and is_deleted = false
        `



        if (messageData.length < 1) {
          throw new Error("Message not Found")
        }



        const updated = await prisma.$queryRaw`
        insert into message (content,sender_id, reply_to_message_id ,chat_id) values(${content},${payload.userId},${message_id} , ${messageData[0].chat_id})
        
        `



        if (!updated) {
          throw new Error("Message  reply Failed")
        }

        return {
          message: "Message Replied successfully",
          status: 201,
          success: true,
        };


      } catch (error) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message
        };
      }
    }



  },
};

export default chatResolver;

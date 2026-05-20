import prisma from "../../../prisma/prisma-client.js";
import { validateToken } from "../../lib/tokenvalidator.js";
import {
  checkChatExists,
  checkMemeberExists,
  checkMessageExists,
  chekUserExists,
} from "../../lib/helpers.js";
const chatResolver = {
  ChatResponse: {
    __resolveType(obj) {
      // console.log(obj, "object dataaa");
      if (obj._responseType === "Emojis") {
        return "Emojis";
      } else if (obj._responseType === "SingleChat") {
        return "SingleChat";
      } else if (obj._responseType === "AllChats") {
        return "AllChats";
      }

      return obj._responseType;
    },
  },
  Query: {
    getChatById: async (_, { input: { chat_ids } }, ctx) => {
      const payload = ctx.user;

      if (chat_ids.length < 1) {
        return {
          message: "Chat Id is missing!",
          status: 404,
          success: false,
        };
      }

      const chat_id = chat_ids[0];

      try {
        const chats = await prisma.$queryRaw`
      SELECT 
      m.id,
    
CASE
    WHEN m.is_deleted THEN 'Deleted message'

    WHEN md.message_id = m.id
         AND md.user_id = ${payload.userId}
    THEN 'Deleted message'

    ELSE m.content

    END AS content,

    m.chat_id,
    m.sender_id,
    m.created_at,
    m.is_forwarded,
    m.is_edited,
    m.is_deleted,
    m.reply_to_message_id as reply_to_message,
    sm.user_id as seen_users,
  COALESCE(r.reactions, '[]'::json) as reactions
FROM message m
LEFT JOIN seen_message sm 

ON m.id = sm.message_id 

left join message_delete_for_me  md
on m.id = md.message_id


LEFT JOIN LATERAL (

    SELECT json_agg(
        json_build_object(
            'react_id', mr.reaction_id,

            'user_id', ru.id


        )
    ) as reactions

    FROM message_reaction mr

    JOIN users ru
        ON ru.id = mr.user_id

    WHERE mr.message_id = m.id

) r ON true


WHERE m.chat_id = ${chat_id};
        `;

        // console.dir(chats, { depth: null });
        // console.log(JSON.stringify(chats, null, 2));

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
        console.log(err);
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

SELECT DISTINCT ON (c.id)

    c.id AS chat_id,
    c.chat_type,

    u.id AS user_id,
    u.name,
    u.profile_pic,

    m.id AS last_message_id,

    CASE 
        WHEN m.is_deleted = true 
        THEN 'Deleted message'

        WHEN m.content IS NULL 
        THEN a.file_type::text
        
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
    FROM message message

    WHERE message.chat_id = c.id

    AND NOT EXISTS (
        SELECT 1
        FROM message_delete_for_me md
        WHERE md.message_id = message.id
        AND md.user_id = ${payload.userId}
    )

    ORDER BY message.created_at DESC
    LIMIT 1

) m ON true

LEFT JOIN attachment a
    ON a.message_id = m.id
    AND m.content IS NULL

WHERE c.id IN (
    SELECT chat_id
    FROM chat_member
    WHERE member_id = ${payload.userId}
)

AND u.id != ${payload.userId}

ORDER BY c.id, m.created_at DESC NULLS LAST;

`;

        // console.log(chats, "chatsssssss");

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
    getEmojis: async (_, __, ctx) => {
      try {
        const data = await prisma.$queryRaw`
        
        select react_id , emoji from reaction
        
        `;

        // console.log(data, "dataaaaaa");

        return {
          message: "Data get Successs",
          success: true,
          data: {
            _responseType: "Emojis",
            items: data,
          },
          status: 200,
        };
      } catch (err) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
  },
  Mutation: {
    sendMessage: async (
      _,
      { input: { chat_ids, reciever_ids, content = null, media = [] } },
      ctx,
    ) => {
      const payload = ctx.user;

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
          
          insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},${new Date()},${chat_id ?? chatId}) returning id
          
          `;

        if (media && media.length > 0) {
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

        // console.log(chatId, "chatiddddd");

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
    editMessage: async (
      _,
      { input: { message_ids, chat_ids, content } },
      ctx,
    ) => {
      const payload = ctx.user;

      // console.log(message_ids, "ctx dataaaaaaaa");
      if (message_ids.length < 1 || !content) {
        return {
          message: "Data is missing",
          success: false,
          status: 400,
        };
      }

      const message_id = message_ids[0];
      try {
        const messageData = await prisma.$queryRaw`
        
        select id,content,sender_id from message where id = ${message_id} and is_deleted = false limit 1
        
        `;

        // console.log(messageData, "message dataaa.");

        if (messageData.length < 1) {
          throw new Error("This message does not exist or has been deleted");
        }

        if (messageData[0].sender_id !== payload.userId) {
          throw new Error("You can only edit your message!");
        }

        const [editMessage, updateMessage] = await Promise.all([
          prisma.$queryRaw`

          insert into edit_message (message_id ,content ,old_content) values(${message_id},${content},${messageData[0].content})

          `,
          prisma.$queryRaw`

UPDATE message
SET 
    content = ${content},
    is_edited = true
WHERE id = ${message_id}

`,
        ]);

        if (!editMessage || !updateMessage) {
          throw new Error("Error in Updating");
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
          error: err.message,
        };
      }
    },
    deleteMessage: async (_, { input: { message_ids, delete_type } }, ctx) => {
      const payload = ctx.user;

      if (!message_ids.length > 0 || !delete_type) {
        return {
          message: "Data is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);
        // const memeberdata = await checkMemeberExists(
        //   prisma,
        //   messageData[0].chat_id,
        //   payload.userId,
        // );
        // if (messageData.length < 1) {
        //   throw new Error(
        //     "This Message doest not Exists or  is Already deleted",
        //   );
        // }

        console.log(messageData, "message dataaaa..._..");

        if (delete_type === "onlyme") {
          const updated = await Promise.all(
            message_ids.map(
              (id) => prisma.$queryRaw`
              
                 insert into message_delete_for_me (
            message_id, user_id
          ) values(${id} , ${payload.userId} )
              
              `,
            ),
          );

          if (!updated) {
            throw new Error("Message Deletion Failed");
          }
        } else if (delete_type === "everyone") {
          const verify = messageData.map((m) => {
            if (m.sender_id != payload.userId) {
              throw new Error(
                "You can only delete  the messages which you have sent!",
              );
            }
          });

          const deleted = await prisma.$queryRaw`
        

        update message set is_deleted = true 
        where id = ANY(${message_ids}) and sender_id = ${payload.userId} ;

        `;

          console.log(deleted, "deleetddddd");

          if (!deleted) {
            throw new Error("Message not deleted..");
          }
        } else {
          throw new Error("Delete type is Invalid");
        }
        return {
          message: "Message Deleted successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    replyMessage: async (
      _,
      { input: { message_ids, chat_ids, content, media } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (message_ids.length !== 1 || (!content && !media)) {
        return {
          message: "Data is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);

        // const memeberdata = await checkMemeberExists(
        //   prisma,
        //   messageData[0].chat_id,
        //   payload.userId,
        // );

        const message_id = message_ids[0];
        // if (messageData.length < 1) {
        //   throw new Error("Message not Found");
        // }

        const updated = await prisma.$queryRaw`
        insert into message (content,sender_id, reply_to_message_id ,chat_id) values(${content},${payload.userId},${message_id} , ${messageData[0].chat_id})
        
        `;

        if (!updated) {
          throw new Error("Message reply Failed");
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
          error: error.message,
        };
      }
    },
    reactMessage: async (
      _,
      { input: { message_ids, chat_ids, reaction_id } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (!message_ids.length > 0 || !reaction_id) {
        return {
          message: "data is Missing",
          success: false,
          status: 400,
        };
      }

      const message_id = message_ids[0];

      try {
        const [messaseData, reactionData] = await Promise.all([
          checkMessageExists(prisma, message_ids),
          prisma.$queryRaw`
          
          select react_id from reaction where react_id = ${reaction_id}

          `,
        ]);

        if (messaseData.length < 1 || reactionData.length < 1) {
          throw new Error(
            "Message or Reaction doesnt exists or has been deleted",
          );
        }

        const updated = await prisma.$queryRaw`
        
        INSERT INTO message_reaction (
    message_id,
    reaction_id,
    user_id
)

VALUES (
   ${message_id},
   ${reaction_id},
   ${payload.userId}
)

ON CONFLICT (message_id, user_id)

DO UPDATE
SET 
    reaction_id = EXCLUDED.reaction_id,
    updated_at = CURRENT_TIMESTAMP;
        
        
        `;

        if (!updated) {
          throw new Error("Reaction Failed");
        }

        return {
          message: "Successfully Reacted Message",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Sonme thing went wrong",
          ststu: 500,
          success: false,
          error: error.message,
        };
      }
    },
    // very complex logic......
    forwardMessage: async (
      _,
      { input: { message_ids, chat_ids = [], reciever_ids = [] } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (
        !message_ids?.length ||
        (!chat_ids?.length && !reciever_ids?.length)
      ) {
        return {
          message: "Data is missing",
          success: false,
          status: 400,
        };
      }

      try {
        // =========================
        // validate messages
        // =========================

        const messages = await checkMessageExists(prisma, message_ids);

        // =========================
        // validate users
        // =========================

        // if (reciever_ids.length > 0) {

        //   const usersData = await chekUserExists(
        //     prisma,
        //     reciever_ids
        //   );

        //   if (
        //     usersData.length !== reciever_ids.length
        //   ) {
        //     throw new Error(
        //       "Some users do not exist"
        //     );
        //   }
        // }

        // =========================
        // final chat ids
        // =========================

        const finalChatIds = [...chat_ids];

        // =========================
        // existing/new chats
        // =========================

        for (const recieverId of reciever_ids) {
          // existing private chat check

          const existingChat = await checkChatExists(prisma, payload.userId, [
            recieverId,
          ]);

          // =========================
          // existing chat
          // =========================

          if (existingChat.length > 0) {
            finalChatIds.push(existingChat[0].chat_id);
          } else {
            // =========================
            // create new private chat
            // =========================

            const newChat = await prisma.$queryRaw`

          INSERT INTO chat (
            chat_type
          )

          VALUES ('private')

          RETURNING id

        `;

            const newChatId = newChat[0].id;

            // =========================
            // add members
            // =========================

            await prisma.$queryRaw`

          INSERT INTO chat_member (
            member_id,
            chat_id
          )

          VALUES
          (
            ${payload.userId},
            ${newChatId}
          ),
          (
            ${parseInt(recieverId)},
            ${newChatId}
          )

        `;

            finalChatIds.push(newChatId);
          }
        }

        // =========================
        // remove duplicates
        // =========================

        const uniqueChatIds = [...new Set(finalChatIds)];

        // =========================
        // clone messages
        // =========================

        for (const message of messages) {
          // original message

          const originalMessage = await prisma.$queryRaw`

        SELECT
          content,
          sender_id,chat_id
        FROM message

        WHERE id = ${message.id}

      `;

          if (originalMessage.length < 1) {
            continue;
          }

          for (const chatId of uniqueChatIds) {
            // =========================
            // create forwarded message
            // =========================

            console.log(
              chatId,
              message.chat_id,
              message,
              originalMessage[0],
              "condiritooo",
            );
            const forwardedMessage = await prisma.$queryRaw`

          INSERT INTO message (
            content,
            sender_id,
            chat_id,
            is_forwarded,
            forwarded_from_message_id
          )

          VALUES (
            ${originalMessage[0].content},
            ${payload.userId},
            ${chatId},
           ${chatId !== message.chat_id ? true : false},
            ${message.id}
          )

          RETURNING id

        `;

            // =========================
            // copy attachments
            // =========================

            const attachments = await prisma.$queryRaw`

          SELECT
            url,
            file_type,
            file_name,
            file_size

          FROM attachment

          WHERE message_id = ${message.id}

        `;

            if (attachments.length > 0) {
              await Promise.all(
                attachments.map((file) => {
                  return prisma.$queryRaw`

                INSERT INTO attachment (
                  message_id,
                  url,
                  file_type,
                  file_name,
                  file_size
                )

                VALUES (
                  ${forwardedMessage[0].id},
                  ${file.url},
                  ${file.file_type},
                  ${file.file_name},
                  ${file.file_size}
                )

              `;
                }),
              );
            }
          }
        }

        return {
          message: "Successfully forwarded message",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    seenMessage: async (_, { input: { message_ids, chat_ids } }, ctx) => {
      const payload = ctx.user;

      if (message_ids.length < 1) {
        return {
          message: "Message id is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);

        const seen = await prisma.seen_message.createMany({
          data: message_ids.map((m) => ({
            message_id: parseInt(m),
            user_id: 2,
          })),
        });

        if (!seen) {
          throw new Error("Error in message seen");
        }
        return {
          message: "Successfully Seen message",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error, "error ");
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

/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";
import { Prisma } from "@prisma/client";
import { logger } from "../../../utils/logger.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";
import { BadRequestError } from "../../../lib/errorHandler.js";
import {
  checkChatExists,
  checkMessageExists,
  createChat,
} from "../../../lib/helpers.js";

export const createNewChatMutation = asyncGraphqlAPIHandeler(
  async (_, { member_id }, ctx) => {
    if (!member_id) {
      throw new BadRequestError("Member id is Missing");
      // return {
      //   message: "Member id is Missing",
      //   status: 400,
      //   success: false,
      // };
    }

    const payload = ctx.user;

    let chat_id = null;
    const exists = await checkChatExists(prisma, payload.userId, [member_id]);

    if (exists.length === 0) {
      chat_id = await createChat({
        payload,
        reciever_id: member_id,

        prisma,
      });
    } else {
      chat_id = exists[0].chat_id;
    }

    return {
      message: "Chat Created Successfully",
      status: 201,
      success: true,
      data: {
        _responseType: "newChat",
        chat_id,
      },
    };
  },
);
export const createNewGroupMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { member_ids, groupName, profile_pic = null } }, ctx) => {
    const payload = ctx.user;

    // if (member_ids.length <= 1) {
    //   return {
    //     message: "Group Can not have only One member",
    //     success: false,
    //     status: 400,
    //   };
    // }

    await prisma.$transaction(async (tx) => {
      const created = await createChat({
        payload,
        reciever_ids: member_ids,
        chat_type: "group",
        prisma: tx,
      });

      await tx.$queryRaw`
      insert into groups (name , chat_id ,profile_pic,created_by_id) values (${groupName},${created[0].id},${profile_pic},${payload.userId});
      `;

      await tx.$queryRaw`
      insert into chat_member (chat_id , member_id , role) values ${Prisma.join(members)}
      `;

      return created[0];
    });

    return {
      message: "Successfully created Group",
      status: 201,
      success: true,
    };
  },
);

export const sendMessageMutation = asyncGraphqlAPIHandeler(
  async (
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
      throw new BadRequestError("Data is missing...");
    }

    // if(reciever_ids && reciever_ids.incldes(payload.userID))

    let chatId = null;
    let chat_id = null;
    if (chat_ids && chat_ids.length > 0) {
      chatId = chat_ids[0];
      chat_id = chat_ids[0];
    }

    if (!chat_id) {
      const reciever_id = parseInt(reciever_ids[0]);
      const reciever = await chekUserExists(prisma, reciever_ids);

      // logger.debug(typeof reciever_id, "type dataaa...");
      if (reciever.length < 1) {
        throw new NotFoundError("Reciever Does not exists");
      }
      // const memeberExists = await checkMemeberExists(prisma, reciever_ids);

      const chatExists = await checkChatExists(
        prisma,
        payload.userId,
        reciever_ids,
      );

      if (chatExists.length < 1) {
        chatId = await createChat(payload, reciever_id, undefined, prisma);
      } else {
        chatId = chatExists[0].chat_id;
      }
    }
    const addMessage = await prisma.$queryRaw`
          
          insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},${new Date()},${chat_id ?? chatId}) returning *
          
          `;

    if (media && media.length > 0) {
      await Promise.all(
        media.map((m) => {
          return prisma.$queryRaw`

          insert into attachment (message_id,url,file_type,file_name,file_size) values(${addMessage[0].id},${m.url},${m.file_type.toLowerCase()},${m.file_name},${m.file_size})

          `;
        }),
      );
    }

    // logger.debug(chatId, "chatiddddd");

    logger.debug(addMessage, "addmessage dataaa");

    // await pubsub.publish(`CHAT_${chat_id}`, addMessage[0]);

    return {
      message: "Message sent successfully",
      status: 201,
      success: true,
    };

    // const chatData = await
  },
);
export const editMessageMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { message_ids, content } }, ctx) => {
    const payload = ctx.user;

    // logger.debug(message_ids, "ctx dataaaaaaaa");
    if (message_ids.length < 1 || !content) {
      throw new BadRequestError("Data is missing");
    }

    const message_id = message_ids[0];

    const messageData = await prisma.$queryRaw`
        
        select id,content,sender_id from message where id = ${message_id} and is_deleted = false limit 1
        
        `;

    // logger.debug(messageData, "message dataaa.");

    if (messageData.length < 1) {
      throw new BadRequestError(
        "This message does not exist or has been deleted",
      );
    }

    if (messageData[0].sender_id !== payload.userId) {
      throw new BadRequestError("You can only edit your message!");
    }

    await Promise.all([
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

    return {
      message: "Message Edited successfully",
      status: 201,
      success: true,
    };
  },
);
export const deleteMessageMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { message_ids, delete_type } }, ctx) => {
    const payload = ctx.user;

    if (message_ids.length === 0 || !delete_type) {
      return {
        message: "Data is Missing",
        status: 400,
        success: false,
      };
    }

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

    logger.debug(messageData, "message dataaaa..._..");

    if (delete_type === "onlyme") {
      const values = message_ids.map(
        (id) => Prisma.sql`(${id}, ${payload.userId})`,
      );

      await prisma.$queryRaw`
  INSERT INTO message_delete_for_me
    (message_id, user_id)
  VALUES ${Prisma.join(values)}
  ON CONFLICT (message_id, user_id)
  DO NOTHING
`;
    } else if (delete_type === "everyone") {
      messageData.map((m) => {
        if (m.sender_id != payload.userId) {
          throw new BadRequestError(
            "You can only delete  the messages which you have sent!",
          );
        }
      });

      const deleted = await prisma.$queryRaw`
        

        update message set is_deleted = true 
        where id = ANY(${message_ids}) and sender_id = ${payload.userId} ;

        `;

      logger.debug(deleted, "deleetddddd");
    } else {
      throw new BadRequestError("Delete type is Invalid");
    }
    return {
      message: "Message Deleted successfully",
      status: 201,
      success: true,
    };
  },
);
export const replyMessageMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { message_ids, content, media } }, ctx) => {
    const payload = ctx.user;

    if (message_ids.length !== 1 || (!content && !media)) {
      throw new BadRequestError("Data is Missing");
    }

    const messageData = await checkMessageExists(prisma, message_ids);
    const message_id = message_ids[0];

    await prisma.$queryRaw`
        insert into message (content,sender_id, reply_to_message_id ,chat_id) values(${content},${payload.userId},${message_id} , ${messageData[0].chat_id})
        `;

    return {
      message: "Message Replied successfully",
      status: 201,
      success: true,
    };
  },
);
export const reactMessageMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { message_ids, reaction_id } }, ctx) => {
    const payload = ctx.user;

    if (!message_ids.length > 0 || !reaction_id) {
      throw new BadRequestError("Data is Missing");
    }

    const message_id = message_ids[0];

    const [messaseData, reactionData] = await Promise.all([
      checkMessageExists(prisma, message_ids),
      prisma.$queryRaw`
          
          select react_id from reaction where react_id = ${reaction_id}

          `,
    ]);

    if (messaseData.length < 1 || reactionData.length < 1) {
      throw new NotFoundError(
        "Message or Reaction doesnt exists or has been deleted",
      );
    }

    await prisma.$queryRaw`
        
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

    return {
      message: "Successfully Reacted Message",
      status: 201,
      success: true,
    };
  },
);
// very complex logic......
export const forwardMessageMutation = asyncGraphqlAPIHandeler(
  async (
    _,
    { input: { message_ids, chat_ids = [], reciever_ids = [] } },
    ctx,
  ) => {
    const payload = ctx.user;

    if (!message_ids?.length || (!chat_ids?.length && !reciever_ids?.length)) {
      throw new BadRequestError("Data is Missing");
    }

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

        const newChatId = await createChat({
          payload,
          recievr_id: recieverId,
          chat_type: "private",
          prisma,
        });

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
  },
);
export const seenMessageMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { message_ids } }, ctx) => {
    const payload = ctx.user;

    if (message_ids.length < 1) {
      throw new BadRequestError("Message id is Missing");
    }

    await checkMessageExists(prisma, message_ids);

    await prisma.seen_message.createMany({
      data: message_ids.map((m) => ({
        message_id: parseInt(m),
        user_id: payload.userId,
      })),
    });

    return {
      message: "Successfully Seen message",
      status: 201,
      success: true,
    };
  },
);

export const setWallpaperMutation = asyncGraphqlAPIHandeler(
  async (_, { url }, ctx) => {
    if (!url || url.length === 0) {
      throw new BadRequestError("Data is Missing");
    }

    const payload = ctx.user;

    await prisma.$queryRaw`
        
        INSERT INTO wallpapers (url, user_id)
VALUES (${url}, ${payload.userId})

ON CONFLICT (user_id)
DO UPDATE SET
    url = EXCLUDED.url,
    created_at = CURRENT_TIMESTAMP;
        
        `;

    return {
      message: "Successfully Uploaded Wallpaper",
      success: true,
      status: 201,
    };
  },
);

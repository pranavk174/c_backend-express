import {
  getSockets,
  isReceiverInRoom,
  chatSocketIds,
  notificationSocketIds,
} from "../../utils/socket.helper.js";
import { chatNamespace, io, notificationNamespace } from "../../index.js";
import prisma from "../../../prisma/prisma-client.js";
import {
  checkMessageExists,
  chekUserExists,
  checkChatExists,
} from "../../lib/helpers.js";

import { logger } from "../../utils/logger.js";
import {
  REFETCH_CHATS,
  MESSAGE_REACTION,
  NEW_MESSAGE,
  ERROR,
  MESSAGE_SEEN,
  NEW_NOTIFICATION,
  NEW_MESSAGE_ALERT,
  EDIT_MESSAGE,
  START_TYPING,
  STOP_TYPING,
} from "../../utils/events.js";
export const sendMessage = async (socket, payload, data, callback) => {
  logger.debug(data, "new messageeeeee");

  const { content, media, chat_ids, reciever_ids } = data;
  if (
    (!content && !media) ||
    (chat_ids && chat_ids.length < 1 && reciever_ids && reciever_ids.length < 1)
  ) {
    return callback({
      message: "Data is missing...",
      status: 400,
      success: false,
    });
  }

  // if(reciever_ids && reciever_ids.incldes(payload.userID))

  let chatId = null;
  let chat_id = null;
  if (chat_ids && chat_ids.length > 0) {
    chatId = chat_ids[0];
    chat_id = chat_ids[0];
  }
  logger.debug(reciever_ids, "type dataaa...", chat_ids);
  try {
    if (!chat_id) {
      const reciever_id = parseInt(reciever_ids[0]);
      const reciever = await chekUserExists(prisma, reciever_ids);

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
    let addMessage = await prisma.$queryRaw`
        
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

      addMessage = addMessage.map((msg) => ({
        ...msg,
        preview: addMedia[0].url,
      }));
    }

    if (!addMessage) {
      throw new Error();
    }

    // ISO string → milliseconds
    const ms = new Date(addMessage[0].created_at).getTime();
    addMessage[0] = { ...addMessage[0], created_at: ms, seen_users: [] };

    reciever_ids.forEach(async (reciever_id) => {
      const receiverInRoom = isReceiverInRoom(socket, reciever_id, chat_ids[0]);
      logger.debug("Receiver room mein hai:", receiverInRoom);
      // logger.debug(`chat:${chat_ids[0]}`, "chat id room id");
      if (receiverInRoom) {
        // Receiver room mein hai — room pe emit karo

        socket.to(`chat:${chat_ids[0]}`).emit(REFETCH_CHATS, addMessage);
      } else {
        const receiverSocketId = chatSocketIds.get(String(reciever_id));
        const notificationRecieverSocketId = notificationSocketIds.get(
          String(reciever_id),
        );

        const res = await prisma.$queryRaw`
      
      insert into notification (reciever_id,sender_id ,notification_type,metadata) values(
        ${reciever_id},${payload.userId},'new_message',   ${JSON.stringify({
          message: `You have a new Message From ${payload.name}`,
        })}::jsonb

      
      
      ) returning *
      
      
      `;

        const notification = {
          notification_id: res[0].notification_id,
          notification_type: res[0].notification_type,
          name: payload.name,
          message: res[0].metadata.message,
          time: res[0].created_at,
          avatar: payload.profile_pic,
          color: "#25D366",
        };

        // logger.debug(
        //   notification,
        //   "notification dataaa",
        //   notificationRecieverSocketId,
        // );

        notificationNamespace
          .to(notificationRecieverSocketId)
          .emit(NEW_NOTIFICATION, notification);
        socket.to(receiverSocketId).emit(NEW_MESSAGE_ALERT, {
          chat_id: addMessage[0].chat_id,
          chat_type: "private",
          user_id: payload.userId,
          name: payload.name,
          blocked: false,
          cover_pic: payload.cover_pic,
          profile_pic: payload.profile_pic,
          bio: payload.bio,
          email: payload.email,
          mobile: payload.mobile,
          last_message_id: addMessage[0].id,
          unread_count: addMessage.length,
          last_message: addMessage[0].content,
          last_message_at: addMessage[0].created_at,
        });
      }
    });

    // logger.debug(addMessage, "chatiddddd");
    // socket.emit(REFETCH_CHATS, addMessage);

    // const chatData = await

    return callback({
      success: true,
      error: "Message sent Successfully",
      status: 201,
      data: {
        message: addMessage[0],
      },
    });
  } catch (error) {
    logger.debug(error);
    socket.emit(ERROR, error.message);
    return callback({
      success: false,
      error: error.message,
      status: 500,
    });
  }
};

export const replyMessage = async (socket, payload, data, callback) => {
  logger.debug(data, "new reply messageeeeee");

  const { message_ids, chat_ids, content, media, reciever_ids } = data;
  if (message_ids.length !== 1 || (!content && !media)) {
    socket.emit(ERROR, "Data is Missing");
    return callback({
      message: "Data is missing...",
      status: 400,
      success: false,
    });
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

    let updated = await prisma.$queryRaw`
    insert into message (content,sender_id, reply_to_message_id ,chat_id) values(${content},${payload.userId},${message_id} , ${messageData[0].chat_id}) returning *
    
    `;

    if (!updated) {
      throw new Error("Message reply Failed");
    }

    if (media && media.length > 0) {
      const [addMedia] = await Promise.all(
        media.map((m) => {
          return prisma.$queryRaw`

      insert into attachment (message_id,url,file_type,file_name,file_size) values(${updated[0].id},${m.url},${m.file_type.toLowerCase()},${m.file_name},${m.file_size}) returning *

      `;
        }),
      );

      if (!addMedia) {
        throw new Error();
      }

      updated = updated.map((msg) => ({
        ...msg,
        preview: addMedia[0].url,
      }));
    }
    // logger.debug(updated, "dadasdsdsad");

    const receiverSocketId = getSockets(reciever_ids[0]);
    if (receiverSocketId) {
      // logger.debug(
      //   "yes condition....................",
      //   chatSocketIds,
      //   receiverSocketId,
      // );
      socket.to(`chat:${chat_ids[0]}`).emit(NEW_MESSAGE, updated);
    }

    socket.to(`chat:${chat_ids[0]}`).emit(REFETCH_CHATS, updated);

    return callback({
      message: "Message Replied successfully",
      status: 201,
      success: true,
    });
  } catch (error) {
    logger.debug(error, "err in reply....");
    socket.emit(ERROR, error.message);
    return callback({
      message: error.message,
      status: 400,
      success: false,
    });
  }
};

export const reactMessage = async (socket, payload, data, callback) => {
  const { message_ids, chat_ids, reciever_ids, react_id: reaction_id } = data;
  // logger.debug(data, "dataaaaaa");
  if (!message_ids.length > 0 || !reaction_id) {
    logger.debug("issue here......", !message_ids.length > 0, !reaction_id);

    socket.emit(ERROR, "data is missing");

    return callback({
      message: "data is Missing",
      success: false,
      status: 400,
    });
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
      throw new Error("Message or Reaction doesnt exists or has been deleted");
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
updated_at = CURRENT_TIMESTAMP returning *;
    
    
    `;

    if (!updated) {
      throw new Error("Reaction Failed");
    }

    // logger.debug(updated, "updated reaction");

    const receiverSocketId = getSockets(reciever_ids[0]);
    if (receiverSocketId) {
      // logger.debug(
      //   "yes condition....................",
      //   chatSocketIds,
      //   receiverSocketId,
      // );
      socket.to(`chat:${chat_ids[0]}`).emit(
        MESSAGE_REACTION,
        (data = {
          message_id: updated[0].message_id,
          react_id: updated[0].reaction_id,
          user_id: updated[0].user_id,
        }),
      );
    }
    // socket.emit(MESSAGE_REACTION, updated[0]);

    return {
      message: "Successfully Reacted Message",
      status: 201,
      success: true,
    };
  } catch (error) {
    logger.debug("error in reactiin", error);
    socket.emit(ERROR, error.message);

    return callback({
      message: "Some thing went wrong",
      status: 500,
      success: false,
      error: error.message,
    });
  }
};

export const seenMessage = async (socket, payload, data, callback) => {
  const { message_ids, chat_id, reciever_id } = data;
  // logger.debug(data, "dataaaaaaaaaaa");
  if (message_ids && message_ids.length < 1) {
    return callback({
      message: "Message id is Missing",
      status: 400,
      success: false,
    });
  }

  try {
    await checkMessageExists(prisma, message_ids);

    // logger.debug(message_ids, "message idsss.");

    const seen = await prisma.seen_message.createManyAndReturn({
      data: message_ids.map((m) => ({
        message_id: parseInt(m),
        user_id: payload.userId,
      })),
    });

    if (!seen) {
      throw new Error("Error in message seen");
    }

    const receiverSocketId = getSockets(reciever_id);
    if (receiverSocketId) {
      // logger.debug(
      //   "yes condition....................",
      //   chatSocketIds,
      //   receiverSocketId,
      // );

      const data = seen.map((d) => ({
        message_id: d.message_id,
        seen_user: d.user_id,
        seen_at: d.seen_at,
      }));

      // logger.debug(data, "dartaaa vent");
      // socket.to(receiverSocketId).emit(MESSAGE_SEEN, data);
      socket.to(`chat:${chat_id}`).emit(MESSAGE_SEEN, data);
    }

    // logger.debug(seen, "seend messagesssss");

    return callback({
      message: "Successfully Seen message",
      status: 201,
      success: true,
      message_ids,
    });
  } catch (error) {
    logger.debug(error, "error ");
    return callback({
      message: "Something went wrong",
      status: 500,
      success: false,
      error: error.message,
      userId: payload,
      message_ids,
    });
  }
};

export const editMessage = async (socket, payload, data, callback) => {
  logger.debug(data, "seen dataaa");
  const { message_ids, content, chat_id } = data;
  if (message_ids.length < 1 || !content) {
    return callback({
      message: "Data is missing",
      success: false,
      status: 400,
    });
  }

  const message_id = message_ids[0];
  try {
    const messageData = await prisma.$queryRaw`
        
        select id,content,sender_id from message where id = ${message_id} and is_deleted = false limit 1
        
        `;

    // logger.debug(messageData, "message dataaa.");

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
WHERE id = ${message_id}    returning *

`,
    ]);

    if (!editMessage || !updateMessage) {
      throw new Error("Error in Updating");
    }

    // logger.debug(
    //   "yes condition....................",
    //   chatSocketIds,
    //   receiverSocketId,
    // );

    const data = updateMessage.map((d) => ({
      id: d.id,
      content: d.content,
      is_edited: true,
    }));

    logger.debug(data, "dartaaa vent");
    // socket.to(receiverSocketId).emit(MESSAGE_SEEN, data);
    socket.to(`chat:${chat_id}`).emit(EDIT_MESSAGE, data[0]);
    // }

    return callback({
      message: "Message Edited successfully",
      status: 201,
      success: true,
      data: updateMessage[0],
    });
  } catch (err) {
    return callback({
      message: "Something went Wrong",
      status: 500,
      success: false,
      error: err.message,
    });
  }
};

export const sendTypingEvent = async (
  socket,
  payload,
  data,
  callback,
  typing = false,
) => {
  logger.debug(data, "new messageeeeee");
  const { reciever_ids, chat_id } = data;

  if (!data) {
    return callback({
      message: "Data is missing...",
      status: 400,
      success: false,
    });
  }

  // if(reciever_ids && reciever_ids.incldes(payload.userID))

  try {
    reciever_ids.forEach(async (reciever_id) => {
      const receiverInRoom = isReceiverInRoom(socket, reciever_id, chat_id);
      logger.debug("Receiver room mein hai:", receiverInRoom);
      // logger.debug(`chat:${chat_ids[0]}`, "chat id room id");
      if (receiverInRoom) {
        // Receiver room mein hai — room pe emit karo

        socket
          .to(`chat:${chat_id}`)
          .emit(typing ? START_TYPING : STOP_TYPING, typing);
      }

      // logger.debug(
      //   notification,
      //   "notification dataaa",
      //   notificationRecieverSocketId,
      // );
    });

    // logger.debug(addMessage, "chatiddddd");
    // socket.emit(REFETCH_CHATS, addMessage);

    // const chatData = await
  } catch (error) {
    logger.debug(error);
    socket.emit(ERROR, error.message);
    return callback({
      success: false,
      error: error.message,
      status: 500,
    });
  }
};

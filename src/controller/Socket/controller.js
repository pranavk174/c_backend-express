import { getSockets, userSocketIDs } from "../../utils/socket.helper.js";
import prisma from "../../../prisma/prisma-client.js";
import {
  checkMessageExists,
  chekUserExists,
  checkChatExists,
  checkMemeberExists,
} from "../../lib/helpers.js";

import {
  REFETCH_CHATS,
  SEND_MESSAGE,
  REPLY_MESSAGE,
  MESSAGE_REACTION,
  NEW_MESSAGE,
  ERROR,
  MESSAGE_SEEN,
} from "../../utils/events.js";
export const sendMessage = async (socket, payload, data, callback) => {
  console.log(data, "new messageeeeee");

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

    // console.log(reciever_ids[0], "clg..... recievr id...");

    const receiverSocketId = userSocketIDs.get(String(reciever_ids[0]));
    addMessage[0] = { ...addMessage[0], seen_users: [] };
    if (receiverSocketId) {
      // console.log(
      //   "yes condition....................",
      //   userSocketIDs,
      //   receiverSocketId,
      // );

      socket.to(`chat:${chat_ids[0]}`).emit(REFETCH_CHATS, addMessage);
    }

    // console.log(addMessage, "chatiddddd");
    // socket.emit(REFETCH_CHATS, addMessage);

    // const chatData = await
  } catch (error) {
    console.log(error);
    socket.emit(ERROR, error.message);
    return callback({
      success: false,
      error: error.message,
      status: 500,
    });
  }
};

export const replyMessage = async (socket, payload, data, callback) => {
  console.log(data, "new reply messageeeeee");

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
    // console.log(updated, "dadasdsdsad");

    const receiverSocketId = getSockets(reciever_ids[0]);
    if (receiverSocketId) {
      // console.log(
      //   "yes condition....................",
      //   userSocketIDs,
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
    console.log(error, "err in reply....");
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
  // console.log(data, "dataaaaaa");
  if (!message_ids.length > 0 || !reaction_id) {
    console.log("issue here......", !message_ids.length > 0, !reaction_id);

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

    // console.log(updated, "updated reaction");

    const receiverSocketId = getSockets(reciever_ids[0]);
    if (receiverSocketId) {
      // console.log(
      //   "yes condition....................",
      //   userSocketIDs,
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
    console.log("error in reactiin", error);
    socket.emit(ERROR, error.message);

    return callback({
      message: "Some thing went wrong",
      ststu: 500,
      success: false,
      error: error.message,
    });
  }
};

export const seenMessage = async (socket, payload, data, callback) => {
  const { message_ids, chat_id, reciever_id } = data;
  // console.log(data, "dataaaaaaaaaaa");
  if (message_ids && message_ids.length < 1) {
    return callback({
      message: "Message id is Missing",
      status: 400,
      success: false,
    });
  }

  try {
    const messageData = await checkMessageExists(prisma, message_ids);

    // console.log(message_ids, "message idsss.");

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
      // console.log(
      //   "yes condition....................",
      //   userSocketIDs,
      //   receiverSocketId,
      // );

      const data = seen.map((d) => ({
        message_id: d.message_id,
        seen_user: d.user_id,
        seen_at: d.seen_at,
      }));

      // console.log(data, "dartaaa vent");
      // socket.to(receiverSocketId).emit(MESSAGE_SEEN, data);
      socket.to(`chat:${chat_id}`).emit(MESSAGE_SEEN, data);
    }

    // console.log(seen, "seend messagesssss");

    return callback({
      message: "Successfully Seen message",
      status: 201,
      success: true,
    });
  } catch (error) {
    console.log(error, "error ");
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

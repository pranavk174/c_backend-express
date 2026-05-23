import { userSocketIDs } from "../../utils/socket.helper.js";
import prisma from "../../../prisma/prisma-client.js";
import { checkMessageExists } from "../../lib/helpers.js";
import {
  REFETCH_CHATS,
  SEND_MESSAGE,
  REPLY_MESSAGE,
  NEW_MESSAGE,
} from "../../utils/events.js";
export const sendMessage = async (socket, payload, data) => {
  console.log(data, "new messageeeeee");

  const { content, media, chat_ids, reciever_ids } = data;
  if (
    (!content && !media) ||
    (chat_ids && chat_ids.length < 1 && reciever_ids && reciever_ids.length < 1)
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

    // console.log(addMessage, "chatiddddd");

    if (!addMessage) {
      throw new Error();
    }

    console.log(reciever_ids[0], "clg..... recievr id...");

    const receiverSocketId = userSocketIDs.get(String(reciever_ids[0]));
    if (receiverSocketId) {
      console.log(
        "yes condition....................",
        userSocketIDs,
        receiverSocketId,
      );
      socket.to(receiverSocketId).emit(NEW_MESSAGE, addMessage);
    }
    socket.emit(REFETCH_CHATS, addMessage);

    // const chatData = await
  } catch (error) {
    console.log(error);
    socket.emit(ERROR, error.message);
    return;
  }
};

export const replyMessage = async (socket, payload, data) => {
  console.log(data, "new reply messageeeeee");

  const { message_ids, chat_ids, content, media, reciever_ids } = data;
  if (message_ids.length !== 1 || (!content && !media)) {
    socket.emit(ERROR, "Data is Missing");
    return;
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
    console.log(updated, "dadasdsdsad");

    const receiverSocketId = userSocketIDs.get(String(reciever_ids[0]));
    if (receiverSocketId) {
      console.log(
        "yes condition....................",
        userSocketIDs,
        receiverSocketId,
      );
      socket.to(receiverSocketId).emit(NEW_MESSAGE, updated);
    }

    socket.emit(REFETCH_CHATS, updated);

    return {
      message: "Message Replied successfully",
      status: 201,
      success: true,
    };
  } catch (error) {
    console.log(error, "err in reply....");
    socket.emit(ERROR, error.message);
    return;
  }
};

import {
  sendMessage,
  seenMessage,
  replyMessage,
  reactMessage,
  editMessage,
  sendTypingEvent,
} from "../controller/Socket/controller.js";
import { seenNotification } from "../controller/Socket/notification.controller.js";
import {
  replyStory,
  seenStory,
  likeStory,
} from "../controller/Socket/story.controller.js";
import { io } from "../index.js";

import {
  SEND_MESSAGE,
  CHAT_JOINED,
  MESSAGE_SEEN,
  CHAT_LEAVED,
  REPLY_MESSAGE,
  MESSAGE_REACTION,
  EDIT_MESSAGE,
  STORY_REPLY,
  STORY_SEEN,
  STORY_LIKE,
  SEEN_NOTIFICATION,
  START_TYPING,
  STOP_TYPING,
} from "../utils/events.js";
import { logger } from "../utils/logger.js";
import {
  chatSocketIds,
  onlineUsers,
  sendUsers,
  joinChat,
  leaveChat,
} from "../utils/socket.helper.js";

export const chatSockets = (socket) => {
  // logger.debug("User connected:", socket.user, socket.id);
  const payload = socket.user;
  chatSocketIds.set(payload.userId.toString(), socket.id);
  onlineUsers.add(payload.userId.toString());

  sendUsers(socket, payload);

  logger.debug(chatSocketIds, "use socet idssss i chatName space");
  // User ka socketId map mein store karo
  // Example event
  socket.on("message", (data) => {
    logger.debug("Message received:", data);

    // sab clients ko emit
    io.emit("message", data);
  });

  socket.on(SEND_MESSAGE, (data, callback) => {
    logger.debug(data, "new messageeeeee");

    sendMessage(socket, payload, data, callback);
  });

  socket.on(CHAT_JOINED, (data, callback) => {
    // logger.debug("chat joined in event user .....", data);

    joinChat(socket, payload, data, callback);
  });

  socket.on(MESSAGE_SEEN, (data, callback) => {
    logger.debug("message seenbd", data, payload);
    seenMessage(socket, payload, data, callback);
  });

  socket.on(CHAT_LEAVED, (data, callback) => {
    // logger.debug("chat ;eaft. user .....", data);

    leaveChat(socket, data, callback);

    logger.debug(" socket leavedddddddd");
  });

  socket.on(REPLY_MESSAGE, (data, callback) => {
    logger.debug(data, "new reply messageeeeee");

    replyMessage(socket, payload, data, callback);
  });

  socket.on(MESSAGE_REACTION, (data, callback) => {
    logger.debug(data, "dataaaaaaa in reaction...");

    reactMessage(socket, payload, data, callback);
  });

  socket.on(EDIT_MESSAGE, (data, callback) => {
    editMessage(socket, payload, data, callback);
  });

  socket.on(STORY_REPLY, (data, callback) => {
    replyStory(socket, payload, data, callback);
  });

  socket.on(STORY_SEEN, (data, callback) => {
    seenStory(socket, payload, data, callback);
  });

  socket.on(STORY_LIKE, (data, callback) => {
    likeStory(socket, payload, data, callback);
  });

  socket.on(SEEN_NOTIFICATION, (data, callback) => {
    seenNotification(socket, payload, data, callback);
  });

  socket.on(START_TYPING, (data, callback) => {
    logger.debug("data recieved in typing", data);
    sendTypingEvent(socket, payload, data, callback, true);
  });

  socket.on(STOP_TYPING, (data, callback) => {
    logger.debug("data stopped in typing", data);
    sendTypingEvent(socket, payload, data, callback, false);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(payload.userId.toString());
    logger.debug("User disconnected:", payload.userId, socket.id, onlineUsers);
    chatSocketIds.delete(String(payload.userId));

    // socket.emit(ONLINE_USERS, Array.from(onlineUsers));
    sendUsers(io, payload);
  });
};

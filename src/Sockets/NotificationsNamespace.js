import { seenNotification } from "../controller/Socket/notification.controller.js";
import {
  replyStory,
  seenStory,
  likeStory,
} from "../controller/Socket/story.controller.js";
import { io } from "../index.js";
import { logger } from "@/utils/logger.js";
import {
  STORY_REPLY,
  STORY_SEEN,
  STORY_LIKE,
  SEEN_NOTIFICATION,
} from "../utils/events.js";
import {
  chatSocketIds,
  onlineUsers,
  sendUsers,
  storySocketIds,
} from "../utils/socket.helper.js";

export const storySockets = (socket) => {
  logger.debug("User connected:", socket.user, socket.id);
  const payload = socket.user;
  storySocketIds.set(payload.userId.toString(), socket.id);
  onlineUsers.add(payload.userId.toString());

  sendUsers(io, payload);

  logger.debug(chatSocketIds, "use socet idssss");
  // User ka socketId map mein store karo
  // Example event
  socket.on("message", (data) => {
    logger.debug("Message received:", data);

    // sab clients ko emit
    io.emit("message", data);
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

  socket.on("disconnect", () => {
    onlineUsers.delete(payload.userId.toString());
    logger.debug("User disconnected:", payload.userId, socket.id, onlineUsers);
    chatSocketIds.delete(String(payload.userId));

    // socket.emit(ONLINE_USERS, Array.from(onlineUsers));
    sendUsers(io, payload);
  });
};

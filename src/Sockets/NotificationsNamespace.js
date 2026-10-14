import { seenNotification } from "../controller/Socket/notification.controller.js";
import { io } from "../index.js";

import { SEEN_NOTIFICATION } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import {
  chatSocketIds,
  notificationSocketIds,
  onlineUsers,
  sendUsers,
  storySocketIds,
} from "../utils/socket.helper.js";

export const NotificationSocket = (socket) => {
  // logger.debug("User connected:", socket.user, socket.id);
  const payload = socket.user;
  notificationSocketIds.set(payload.userId.toString(), socket.id);
  onlineUsers.add(payload.userId.toString());

  sendUsers(io, payload);

  logger.debug(
    notificationSocketIds,
    "use socet idssss i notification name sapce",
  );
  // User ka socketId map mein store karo
  // Example event

  socket.on(SEEN_NOTIFICATION, (data, callback) => {
    logger.debug("data in notification", data);
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

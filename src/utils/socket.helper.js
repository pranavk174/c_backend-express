export const userSocketIDs = new Map(); // userId -> socketId
export const onlineUsers = new Set();
import { ONLINE_USERS } from "./events.js";
export const joinChat = (data) => {
  const { user_id } = data;
  // console.log("chat joined user .....", data);
  onlineUsers.add(user_id.toString());
};

export const leaveChat = (data) => {
  const { user_id } = data;
  // console.log("chat ;eaft. user .....", data);
  onlineUsers.delete(user_id.toString());
};

export const getSockets = (member) => {
  const receiverSocketId = userSocketIDs.get(String(member));
  return receiverSocketId;
};

export const getSocketmembers = (id) => {
  const data = Array.from(userSocketIDs).map((d) => d[1]);
  return data;
};

export const sendUsers = (socket) => {
  console.log(onlineUsers, "users online");

  socket.emit(ONLINE_USERS, Array.from(onlineUsers));
};

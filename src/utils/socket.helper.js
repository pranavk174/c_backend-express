export const userSocketIDs = new Map(); // userId -> socketId
export const onlineUsers = new Set();

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

export const getSocket = (member) => {};



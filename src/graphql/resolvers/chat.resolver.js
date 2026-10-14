import {
  getAllChatsQuery,
  getAllMembersQuery,
  getChatByIdQuery,
  getEmojisQuery,
  getWallPaperQuery,
} from "../controllers/chat/chat.query.js";
import {
  createNewChatMutation,
  createNewGroupMutation,
  deleteMessageMutation,
  editMessageMutation,
  forwardMessageMutation,
  reactMessageMutation,
  replyMessageMutation,
  seenMessageMutation,
  sendMessageMutation,
  setWallpaperMutation,
} from "../controllers/chat/chat.mutation.js";
const chatResolver = {
  ChatResponse: {
    __resolveType(obj) {
      // logger.debug(obj, "object dataaa");
      if (obj._responseType === "Emojis") {
        return "Emojis";
      } else if (obj._responseType === "SingleChat") {
        return "SingleChat";
      } else if (obj._responseType === "newChat") {
        return "newChat";
      } else if (obj._responseType === "AllChats") {
        return "AllChats";
      } else if (obj._responseType === "members") {
        return "members";
      } else if (obj._responseType === "Wallpaper") {
        return "Wallpaper";
      }
      return obj._responseType;
    },
  },
  Query: {
    getChatById: getChatByIdQuery,
    getMembers: getAllMembersQuery,
    getAllChats: getAllChatsQuery,
    getEmojis: getEmojisQuery,
    getWallPaper: getWallPaperQuery,
  },
  Mutation: {
    createNewChat: createNewChatMutation,
    createNewGroup: createNewGroupMutation,
    sendMessage: sendMessageMutation,
    editMessage: editMessageMutation,
    deleteMessage: deleteMessageMutation,
    replyMessage: replyMessageMutation,
    reactMessage: reactMessageMutation,
    // very complex logic......
    forwardMessage: forwardMessageMutation,
    seenMessage: seenMessageMutation,

    setWallpaper: setWallpaperMutation,
  },
};

export default chatResolver;

import {
  getAllusersQuery,
  getUserQuery,
} from "../controllers/User/user.query.js";
import {
  blockUserMutation,
  createUserMutation,
  deleteAccountMutation,
  generateRefreshTokenMutation,
  logoutMutation,
  sendOtpMutation,
  unBlockUserMutation,
  updatePreferenceMutation,
  updateUserMutation,
  verifyOtpMutation,
} from "../controllers/User/user.mutation.js";
const userResolvers = {
  ResponseData: {
    __resolveType(obj) {
      if (obj._responseType === "verifyOtpData") {
        return "verifyOtpData";
      }

      if (obj._responseType === "User") {
        return "User";
      }
      if (obj._responseType === "Users") {
        return "Users";
      }

      return null;
    },
  },
  Query: {
    getUser: getUserQuery,
    getUsers: getAllusersQuery,
  },
  Mutation: {
    sendOtpMail: sendOtpMutation,
    verifyOtp: verifyOtpMutation,
    createUser: createUserMutation,
    updateUser: updateUserMutation,
    updatePreference: updatePreferenceMutation,
    deleteUser: deleteAccountMutation,
    generateRefreshToken: generateRefreshTokenMutation,
    logout: logoutMutation,
    blockUser: blockUserMutation,
    unBlockUser: unBlockUserMutation,
  },
};

export default userResolvers;

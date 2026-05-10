import userResolver from "../resolvers/user.resolver.js";
import Storyresolver from "../resolvers/story.resolver.js";
import { privacyResolvers } from "./privacy.resolver.js";
import chatResolver from "./chat.resolver.js";
const mergedResolvers = {
  Query: {
    ...userResolver.Query,
    ...Storyresolver.Query,
    ...privacyResolvers.Query,
    ...chatResolver.Query,
  },
  Mutation: {
    ...userResolver.Mutation,
    ...Storyresolver.Mutation,
    ...privacyResolvers.Mutation,
    ...chatResolver.Mutation,
  },
  ResponseData: {
    __resolveType(obj) {
      if (obj.fname || obj.user_name || obj.mobile) return "User";
      if (obj.content) return "Story";
      return null;
    },
  },
  storyResponseData: Storyresolver.storyResponseData,
  ChatResponse: chatResolver.ChatResponse
};

export default mergedResolvers;

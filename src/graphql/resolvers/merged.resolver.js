import userResolver from "../resolvers/user.resolver.js";
import Storyresolver from "../resolvers/story.resolver.js";
import { privacyResolvers } from "./privacy.resolver.js";

const mergedResolvers = {
  Query: {
    ...userResolver.Query,
    ...Storyresolver.Query,
    ...privacyResolvers.Query,
  },
  Mutation: {
    ...userResolver.Mutation,
    ...Storyresolver.Mutation,
    ...privacyResolvers.Mutation,
  },
  ResponseData: {
    __resolveType(obj) {
      if (obj.fname || obj.user_name || obj.mobile) return "User";
      if (obj.content) return "Story";
      return null;
    },
  },
  storyResponseData: Storyresolver.storyResponseData,
};

export default mergedResolvers;

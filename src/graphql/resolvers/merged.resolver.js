import userResolver from "../resolvers/user.resolver.js";
import Storyresolver from "../resolvers/story.resolver.js";

const mergedResolvers = {
  Query: {
    ...userResolver.Query,
    ...Storyresolver.Query,
  },
  Mutation: {
    ...userResolver.Mutation,
    ...Storyresolver.Mutation,
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

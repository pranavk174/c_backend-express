import userResolver from "../resolvers/user.resolver.js";
import Storyresolver from "../resolvers/story.resolver.js";
import { privacyResolvers } from "./privacy.resolver.js";
import { notificationResolver } from "./notification.resolver.js";
import chatResolver from "./chat.resolver.js";
import { GraphQLBigInt } from "graphql-scalars";
const mergedResolvers = {
  BigInt: GraphQLBigInt,

  Query: {
    ...userResolver.Query,
    ...Storyresolver.Query,
    ...privacyResolvers.Query,
    ...chatResolver.Query,
    ...notificationResolver.Query,
  },
  Mutation: {
    ...userResolver.Mutation,
    ...Storyresolver.Mutation,
    ...privacyResolvers.Mutation,
    ...chatResolver.Mutation,
    ...notificationResolver.Mutation,
  },
  // ResponseData: {
  //   __resolveType(obj) {
  //     if (obj.fname || obj.user_name || obj.mobile) return "User";
  //     if (obj.content) return "Story";
  //     return null;
  //   },
  // },
  ResponseData: userResolver.ResponseData,
  storyResponseData: Storyresolver.storyResponseData,
  ChatResponse: chatResolver.ChatResponse,
  NotificationResponse: notificationResolver.ResponseData,
};

export default mergedResolvers;

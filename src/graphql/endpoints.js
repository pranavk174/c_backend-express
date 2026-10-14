import { createYoga, createSchema } from "graphql-yoga";

import { readFileSync } from "fs";
import {
  authDirectiveTransformer,
  isChatMemberDirective,
  inputValidatorDirective,
} from "./custom-directives/directives.js";
import { useCookies } from "@whatwg-node/server-plugin-cookies";
import mergedResolver from "./resolvers/merged.resolver.js";
import { AppError } from "../lib/errorHandler.js";
import { logger } from "../utils/logger.js";

const baseSchema = readFileSync(
  new URL("./schema/base.schema.gql", import.meta.url),
  "utf-8",
);

const PrivacySchema = readFileSync(
  new URL("./schema/privacy.schema.gql", import.meta.url),
  "utf-8",
);

const userSchema = readFileSync(
  new URL("./schema/user.schema.gql", import.meta.url),
  "utf-8",
);

const storySchema = readFileSync(
  new URL("./schema/story.schema.gql", import.meta.url),
  "utf-8",
);

const chatSchema = readFileSync(
  new URL("./schema/chats.schema.gql", import.meta.url),
  "utf-8",
);

const notificationSchema = readFileSync(
  new URL("./schema/notification.schema.gql", import.meta.url),
  "utf-8",
);

const typeDefs =
  baseSchema +
  userSchema +
  storySchema +
  PrivacySchema +
  chatSchema +
  notificationSchema;

let schema = createSchema({
  typeDefs,
  resolvers: mergedResolver,
});
schema = inputValidatorDirective(schema);
schema = isChatMemberDirective(schema);
schema = authDirectiveTransformer(schema);

export const yoga = createYoga({
  schema,

  graphqlEndpoint: "/graphql",

  context: ({ req, res }) => ({
    req,
    res,
  }),
  plugins: [useCookies()],
});

import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "fs";

import { useCookies } from "@whatwg-node/server-plugin-cookies";
import mergedResolver from "./resolvers/merged.resolver.js";
import {
  useJWT,
  extractFromCookie,
  createInlineSigningKeyProvider,
} from "@graphql-yoga/plugin-jwt";

import path from "path";

const baseSchema = readFileSync(
  new URL("./schema/base.schema.gql", import.meta.url),
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

const typeDefs = baseSchema + userSchema + storySchema;

const schema = createSchema({
  typeDefs,
  resolvers: mergedResolver,
});
const signingKey = process.env.JWT_SECRET;
export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  plugins: [
    useCookies(),
    useJWT({
      signingKeyProviders: [
        createInlineSigningKeyProvider(process.env.JWT_SECRET),
      ],

      tokenLookupLocations: [
        extractFromCookie({ name: "accessToken" }), // 👈 cookie se token uthao
      ],

      extendContext: true,

      reject: {
        missingToken: false, // 👈 taaki public routes chale
        invalidToken: false,
      },
    }),
  ],
});

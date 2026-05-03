import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "fs";
import { resolvers } from "./resolvers/user.resolver.js";

const typeDefs = readFileSync(
  new URL("./schema/user.schema.gql", import.meta.url),
  "utf8"
);
 const schema = createSchema({
  typeDefs,
  resolvers: resolvers,
});


export const yoga = createYoga({
    schema,graphqlEndpoint: '/graphql'
})
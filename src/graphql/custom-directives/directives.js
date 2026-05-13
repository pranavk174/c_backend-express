import { defaultFieldResolver, GraphQLError } from "graphql";

import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

import { validateToken } from "../../lib/tokenvalidator.js";

export function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, "auth")?.[0];

      if (authDirective) {
        const originalResolver = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async function (source, args, context, info) {
          try {
            console.log("AUTH DIRECTIVE RUNNING");

            // TOKEN VALIDATION
            const payload = await validateToken(context);

            // USER CONTEXT
            context.user = payload;

            // ORIGINAL RESOLVER
            return await originalResolver(source, args, context, info);
          } catch (error) {
            throw new GraphQLError(error.message || "Unauthorized");
          }
        };
      }

      return fieldConfig;
    },
  });
}

import { defaultFieldResolver, GraphQLError } from "graphql";
import prisma from "../../../prisma/prisma-client.js";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

import { validateToken } from "../../lib/tokenvalidator.js";
import { checkChatExists, checkMemeberExists } from "../../lib/helpers.js";
import { Prisma } from "@prisma/client";
export function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, "auth")?.[0];

      if (authDirective) {
        const originalResolver = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async function (source, args, context, info) {
          try {
            // console.log("AUTH DIRECTIVE RUNNING");

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

export const isChatMemberDirective = (schema) => {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const directive = getDirective(schema, fieldConfig, "isChatMember")?.[0];

      if (directive) {
        const { resolve = defaultFieldResolver } = fieldConfig;

        fieldConfig.resolve = async function (source, args, context, info) {
          const userId = context.user.userId;

          const chat_id =
            args.chat_id || args.input?.chat_id || args.input?.chat_ids?.[0];

          if (!chat_id) {
            throw new Error("Chat id missing");
          }

          if (
            Array.isArray(args.input.chat_ids) &&
            args.input.chat_ids.length > 0
          ) {
            const data = await prisma.$queryRaw`

    SELECT member_id
    FROM chat_member

  WHERE chat_id IN (${Prisma.join(args.input.chat_ids)})
    AND member_id = ${userId}

  `;

            // console.log(data, "dataaaaaaa");
            if (data.length !== args.input.chat_ids.length) {
              throw new Error("User is not a member of all chats");
            }
          }

          const data = await checkMemeberExists(prisma, chat_id, userId);

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
};

import { defaultFieldResolver, GraphQLError } from "graphql";
import prisma from "../../../prisma/prisma-client.js";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

import {
  errorHandler,
  validateCookie,
  validateToken,
} from "../../lib/tokenvalidator.js";
import { checkMemeberExists } from "../../lib/helpers.js";
import { Prisma } from "@prisma/client";
import { logger } from "../../utils/logger.js";
import { asyncGraphqlAPIHandeler } from "../../lib/util.js";
export function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, "auth")?.[0];

      if (authDirective) {
        const originalResolver = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = asyncGraphqlAPIHandeler(
          async function (source, args, context, info) {
            // logger.debug("AUTH DIRECTIVE RUNNING");
            const cookie = await context.request.cookieStore.get("accessToken");
            // TOKEN VALIDATION
            const payload = await validateCookie(cookie);

            // USER CONTEXT
            context.user = payload;

            // ORIGINAL RESOLVER
            return await originalResolver(source, args, context, info);
          },
        );
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
            return errorHandler("Chat id is required", "BAD_REQUEST", 400);
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

            // logger.debug(data, "dataaaaaaa");
            if (data.length !== args.input.chat_ids.length) {
              return errorHandler(
                "User is not a member of all chats",
                "FORBIDDEN",
                403,
              );
            }
          }

          const data = await checkMemeberExists(prisma, chat_id, userId);

          if (data.length < 1) {
            return errorHandler(
              "You are not a member of this chat",
              "FORBIDDEN",
              403,
            );
          }

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
};

export function inputValidatorDirective(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(
        schema,
        fieldConfig,
        "inputvalidate",
      )?.[0];

      if (authDirective) {
        const originalResolver = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async function (source, args, context, info) {
          try {
            logger.debug("INPUT DIRECTIVE RUNNING");

            const { ...inputs } = args;

            logger.debug(inputs, "input dataaaa...");

            // ORIGINAL RESOLVER
            return await originalResolver(source, args, context, info);
          } catch (error) {
            logger.debug(error.message, "invalid data in inputValdiate");
            // throw new GraphQLError(error.message || "Unauthorized");
            // return errorHandler(error.message, error.name, 401, error);
            throw error;
          }
        };
      }

      return fieldConfig;
    },
  });
}

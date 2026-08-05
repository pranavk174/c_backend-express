import { AppError } from "../../../lib/errorHandler.js";
import prisma from "../../../../prisma/prisma-client.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";
export const getUserQuery = asyncGraphqlAPIHandeler(async (_, __, context) => {
  const payload = context.user;
  const data = await prisma.users.findFirst({
    where: {
      email: payload.email,
    },
  });

  if (!data) {
    // logger.debug("error in data getting");
    throw new AppError({
      message: "User Not Found",
      status: 404,
      code: "NOT_FOUND_ERROR",
    });
  }

  // logger.debug(data, "userssss");

  return {
    message: "successfully retrived",
    status: 200,
    data: {
      _responseType: "User",
      ...data,
    },
    success: true,
  };
});

export const getAllusersQuery = asyncGraphqlAPIHandeler(async (_, __, ctx) => {
  const payload = ctx.user;

  const users = await prisma.$queryRaw`
        SELECT
        u.*,
        MAX(cm.chat_id) AS chat_id
    FROM users u
   LEFT JOIN chat_member cm
    ON u.id = cm.member_id
    AND cm.chat_id IN (
        SELECT cm2.chat_id
        FROM chat_member cm2
        LEFT JOIN chat c
            ON c.id = cm2.chat_id
        WHERE cm2.member_id = ${payload.userId}
          AND c.chat_type = 'private'
    )
    
    WHERE u.id <> ${payload.userId}
    GROUP BY u.id;
      
        
        `;

  return {
    message: "Successfully retrieved Users",
    status: 200,
    success: true,
    data: {
      _responseType: "Users",
      items: users,
    },
  };

  // logger.debug(users, "users dataaaaaa.");
});

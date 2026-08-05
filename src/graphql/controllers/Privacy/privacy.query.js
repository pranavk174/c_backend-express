import { AppError } from "../../../lib/errorHandler.js";
import prisma from "../../../../prisma/prisma-client.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";
import { logger } from "../../../utils/logger.js";

const { privacy_user, privacy_settings } = prisma;
export const getPrivacySettingsQuery = asyncGraphqlAPIHandeler(
  async (_, __, ctx) => {
    const payload = ctx.user;
    const userId = payload.userId;

    const settings = await privacy_settings.findMany({
      where: {
        user_id: userId,
      },
    });

    if (!settings || settings.length === 0) {
      throw new AppError({
        message: "No privacy settings found for the user",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    return {
      message: "Successfully retrieved privacy settings",
      status: 200,
      success: true,
      data: {
        __typename: "PrivacyList",
        items: settings,
      },
    };
  },
);

export const getPrivacUsersQuery = asyncGraphqlAPIHandeler(
  async (_, { privacy_id }) => {
    const privacyUsers = await prisma.$queryRaw`
                                select u.id,u.name
                                from users u
                                inner join privacy_user p
                                on p.target_user_id = u.id
                                where p.privacy_id = ${privacy_id};
        `;

    logger.debug(privacyUsers, "privacyUserssss");

    return {
      message: "Successfully retrieved privacy users",
      status: 200,
      success: true,
      data: {
        __typename: "UserList",
        items: privacyUsers,
      },
    };
  },
);

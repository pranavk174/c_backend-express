import prisma from "../../../prisma/prisma-client.js";
import { validateToken } from "../../lib/tokenvalidator.js";
import { asyncGraphqlAPIHandeler } from "../../lib/util.js";
import { logger } from "../../utils/logger.js";

const { privacy_user, privacy_settings } = prisma;

export const privacyResolvers = {
  //   privacyResponseData: {
  //     __resolveType(obj) {
  //       // multiple stories
  //       if (obj.stories) {
  //         return "PrivacyusersData";
  //       }
  //       // single story — check key existence since text_data can be null
  //       if ("id" in obj) {
  //         return "PrivacySettingsData";
  //       }
  //       return null;
  //     },
  //   },
  Query: {
    getPrivacySettings:
      asyncGraphqlAPIHandeler(async (_, __, ctx) => {
        const payload = ctx.user;
        const userId = payload.userId;


        const settings = await privacy_settings.findMany({
          where: {
            user_id: userId,
          },
        });

        if (!settings || settings.length === 0) {
          throw new Error("No privacy settings found for the user");
        }

        logger.debug(settings, "setting.....");

        return {
          message: "Successfully retrieved privacy settings",
          status: 200,
          success: true,
          data: {
            __typename: "PrivacyList",
            items: settings,
          },
        };

      }),
    getPrivacyUsers:
      asyncGraphqlAPIHandeler(async (_, { privacy_id }) => {

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

      }),
  },
  Mutation: {
    updatePrivacySettings:
      asyncGraphqlAPIHandeler(async (_, { privacy_type, entity_type }, ctx) => {
        const payload = ctx.user;
        const userId = payload.userId;

        if (!privacy_type || !entity_type) {
          return {
            message: "privacy_type and entity_type are required",
            status: 400,
            success: false,
          };
        }
        // Update privacy settings for the user

        const updatedSettings = await privacy_settings.upsert({
          where: {
            user_id_entity_type: {
              user_id: userId,
              entity_type: entity_type.toString(),
            },
          },
          update: {
            privacy_type: privacy_type.toString(),
            entity_type: entity_type.toString(),
            created_at: new Date(),
          },
          create: {
            user_id: userId,
            privacy_type: privacy_type.toString(),
            entity_type: entity_type.toString(),
            created_at: new Date(),
          },
        });

        if (!updatedSettings) {
          throw new Error("Failed to update privacy settings");
        }
        return {
          message: "Successfully updated privacy settings",
          status: 200,
          success: true,
        };

      }),
    updatePrivacyUsers:
      asyncGraphqlAPIHandeler(async (_, { input: { users, privacy_id } }, ctx) => {
        const payload = ctx.user;

        const userId = payload.userId;

        if (!users || users.length === 0 || !privacy_id) {
          return {
            message: "users and privacy_id are required",
            status: 400,
            success: false,
          };
        }

        if (users.includes(userId.toString())) {
          return {
            message: "User cannot be in the list of privacy users",
            status: 400,
            success: false,
          };
        }


        const updatedUsers = await Promise.all(
          users.map(async (user) => {
            await privacy_user.upsert({
              where: {
                privacy_id_target_user_id: {
                  privacy_id: parseInt(privacy_id),
                  target_user_id: parseInt(user),
                },
              },
              update: {
                privacy_id: parseInt(privacy_id),
                target_user_id: parseInt(user),
                created_at: new Date(),
              },
              create: {
                privacy_id: parseInt(privacy_id),
                target_user_id: parseInt(user),
                created_at: new Date(),
              },
            });
          }),
        );

        if (!updatedUsers || updatedUsers.length === 0) {
          throw new Error("Failed to update privacy users");
        }
        return {
          message: "Successfully updated privacy users",
          status: 200,
          success: true,
        };

      }),
  },
};

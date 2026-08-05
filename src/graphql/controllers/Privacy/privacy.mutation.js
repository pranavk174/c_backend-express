/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";

import { AppError } from "../../../lib/errorHandler.js";

import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";

const { privacy_user, privacy_settings } = prisma;
export const updatePrivacySettingsMutation = asyncGraphqlAPIHandeler(
  async (_, { privacy_type, entity_type }, ctx) => {
    const payload = ctx.user;
    const userId = payload.userId;

    if (!privacy_type || !entity_type) {
      throw new AppError({
        message: "privacy_type and entity_type are required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }
    // Update privacy settings for the user

    await privacy_settings.upsert({
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

    return {
      message: "Successfully updated privacy settings",
      status: 200,
      success: true,
    };
  },
);

export const updatePrivacyUsersMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { users, privacy_id } }, ctx) => {
    const payload = ctx.user;

    const userId = payload.userId;

    if (!users || users.length === 0 || !privacy_id) {
      throw new AppError({
        message: "users and privacy_id are required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    if (users.includes(userId.toString())) {
      throw new AppError({
        message: "User cannot be in the list of privacy users",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    await Promise.all(
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

    return {
      message: "Successfully updated privacy users",
      status: 200,
      success: true,
    };
  },
);

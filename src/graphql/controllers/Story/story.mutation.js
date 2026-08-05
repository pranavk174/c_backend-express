/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";

import { AppError } from "../../../lib/errorHandler.js";

import { logger } from "../../../utils/logger.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";

const { story, story_likes, chat, chat_member } = prisma;
export const createStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { content, text_data, message_ids = [] } }, context) => {
    if ((!content || content.trim() === "") && message_ids.length === 0) {
      throw new AppError({
        message: "Content is required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const payload = context.user;

    if (message_ids.length > 0) {
      const media = await prisma.$queryRaw`
          
          select * from attachment where message_id = ANY(${message_ids})
          
          `;

      await prisma.story.createMany({
        data: media.map((m) => {
          return {
            content: m.url,
            text_data,
            user_id: payload.userId,

            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          };
        }),
      });
    } else {
      await prisma.story.create({
        data: {
          content,
          text_data,
          user_id: payload.userId,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours ke liye valid
        },
      });
    }
    return {
      message: "Story created successfully",
      status: 201,
      success: true,
    };
  },
);

export const likeStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { id, like, reaction_id } }, context) => {
    if (!id || like === null || like === undefined) {
      throw new AppError({
        message: "Like value is required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const payload = context.user;

    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      throw new AppError({
        message: "Story not found",
        status: 404,
        code: "BAD_REQUEST",
      });
    }

    if (storyData.user_id === payload.userId) {
      throw new AppError({
        message: "You cannot like your own story",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    await story_likes.upsert({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: payload.userId,
        },
      },
      update: {
        liked: like,
        created_at: new Date(),
        reaction_id: like === true ? reaction_id : null, // only set reaction_id if it's a like
      },
      create: {
        story_id: parseInt(id),
        user_id: payload.userId,
        reaction_id: like === true ? reaction_id : null,
        liked: true,
        created_at: new Date(),
      },
    });

    return {
      message: `Story ${like === true ? "liked" : "unliked"} successfully`,
      status: 200,
      success: true,
    };
  },
);

export const seenStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { id }, context) => {
    if (!id) {
      throw new AppError({
        message: "Story ID is required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const payload = context.user;
    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      throw new AppError({
        message: "Story not found",
        status: 404,
        code: "BAD_REQUEST",
      });
    }
    if (storyData.user_id === payload.userId) {
      throw new AppError({
        message: "You cannot seen your own story",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const seenData = await prisma.$queryRaw`
        
        select user_id from story_seen where story_id = ${parseInt(id)} and user_id = ${payload.userId};
        
        `;

    if (seenData.length > 0) {
      return {
        message: "Story already marked as seen",
        status: 400,
        success: false,
      };
    }

    // Mark the story as seen by creating an entry in a hypothetical "story_views" table
    await prisma.story_seen.create({
      data: {
        story_id: parseInt(id),
        user_id: payload.userId,
        seen_at: new Date(),
      },
    });

    return {
      message: "Story marked as seen",
      status: 200,
      success: true,
    };
  },
);

export const replyToStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { id, content }, context) => {
    if (!content || content.trim() === "") {
      throw new BadRequestError("Content is required");
    }

    const payload = context.user;

    logger.debug(payload, "payloadddddd");
    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      throw new NotFoundError("Story not found");
    }

    let chatid = await prisma.$queryRaw`
        select chat_id from chat_member where member_id in (${parseInt(payload.userId)}, ${parseInt(storyData.user_id)}) GROUP BY chat_id
HAVING COUNT(DISTINCT member_id) = 2;
        
        `;

    // logger.debug(chatid, "chatdataaaaaaa", storyData);

    if (!chatid || chatid.length === 0) {
      const chatData = await chat.create({
        data: {
          chat_type: "private",
          created_at: new Date(),
        },
      });

      await chat_member.createMany({
        data: [
          {
            chat_id: chatData.id,
            member_id: payload.userId,
            joined_at: new Date(),
          },
          {
            chat_id: chatData.id,
            member_id: storyData.user_id,
            joined_at: new Date(),
          },
        ],
      });

      chatid = chatData.id;
    }

    // const reply = await prisma.chat_member.

    const reply = await prisma.$queryRaw`
insert into message (
chat_id ,sender_id ,content ,story_id, created_at) values(${chatid[0].chat_id} , ${parseInt(payload.userId)} , ${content}, ${parseInt(storyData.id)}, NOW()
)
  `;

    return {
      message: "Reply added successfully",
      status: 201,
      success: true,
      data: reply,
    };
  },
);

export const forwardStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { storyId, targets, message } }, context) => {
    if (!targets || targets.length === 0) {
      throw new BadRequestError("At least one target is required");
    }

    const payload = context.user;
    const storyData = await story.findFirst({
      where: { id: parseInt(storyId), is_deleted: false },
    });

    if (!storyData) {
      throw new NotFoundError("Story not found");
    }

    await Promise.all(
      targets.map(async (target) => {
        if (target.type === "private") {
          if (!target.chatId) {
            const chatData = await chat.create({
              data: {
                chat_type: "private",
                created_at: new Date(),
              },
            });
            await chat_member.createMany({
              data: [
                {
                  chat_id: chatData.id,
                  member_id: payload.userId,
                  joined_at: new Date(),
                },
                {
                  chat_id: chatData.id,
                  member_id: target.recipientId,
                  joined_at: new Date(),
                },
              ],
            });
            await prisma.$queryRaw`
                insert into message (
                  chat_id ,sender_id ,content ,story_id, created_at) values(${parseInt(chatData.id)} , ${parseInt(payload.userId)} , ${message}, ${parseInt(storyData.id)}, NOW()
                )
                `;
          } else {
            await prisma.$queryRaw`
                insert into message (
                  chat_id ,sender_id ,content ,story_id, created_at) values(${parseInt(target.chatId)} , ${parseInt(payload.userId)} , ${message}, ${parseInt(storyData.id)}, NOW()
                )
                `;
          }
        } else if (target.type === "group") {
          const isMember = await chat_member.findFirst({
            where: {
              chat_id: parseInt(target.chatId),
              member_id: payload.userId,
            },
          });

          if (!isMember) {
            throw new BadRequestError(
              "You are not a member of the target group",
            );
          }

          await prisma.$queryRaw`
                insert into message (
                  chat_id ,sender_id ,content ,story_id, created_at) values(${parseInt(target.chatId)} , ${parseInt(payload.userId)} , ${message}, ${parseInt(storyData.id)}, NOW()
                )
                `;
        }
      }),
    );

    return {
      message: "Story forwarded successfully",
      status: 200,
      success: true,
    };
  },
);

export const deleteStoryMutation = asyncGraphqlAPIHandeler(
  async (_, { id }, context) => {
    const payload = context.user;
    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      throw new NotFoundError("Story not found");
    }
    if (storyData.user_id !== payload.userId) {
      throw new ForbiddenError("You can only delete your own story");
    }
    await story.update({
      where: { id: parseInt(id) },
      data: { is_deleted: true },
    });

    return {
      message: "Story deleted successfully",
      status: 200,
      success: true,
    };
  },
);

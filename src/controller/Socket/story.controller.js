import prisma from "../../../prisma/prisma-client.js";

const { story, story_likes, chat, chat_member, message } = prisma;
export const replyStory = async (socket, payload, data, callback) => {
  const { id, content } = data;

  try {
    console.log(payload, "payloadddddd");
    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      return callback({
        message: "Story not found",
        status: 404,
        success: false,
      });
    }

    const chatid = await prisma.$queryRaw`
        select chat_id from chat_member where member_id in (${parseInt(payload.userId)}, ${parseInt(storyData.user_id)}) GROUP BY chat_id
HAVING COUNT(DISTINCT member_id) = 2;
        
        `;

    console.log(chatid, "chatdataaaaaaa", storyData);

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

      const reply = await prisma.$queryRaw`
insert into message (
chat_id ,sender_id ,content ,story_id, created_at) values(${chatData.id} , ${parseInt(payload.userId)} , ${content}, ${parseInt(storyData.id)}, NOW()
)

          `;

      if (!reply) {
        throw new Error("Failed to send reply");
      }
      return {
        message: "Reply added successfully",
        status: 201,
        success: true,
        // data: reply,
      };
    }

    // const reply = await prisma.chat_member.

    const reply = await prisma.$queryRaw`
insert into message (
chat_id ,sender_id ,content ,story_id, created_at) values(${chatid[0].chat_id} , ${parseInt(payload.userId)} , ${content}, ${parseInt(storyData.id)}, NOW()
)
  `;

    if (!reply) {
      throw new Error("Failed to send reply");
    }

    return callback({
      message: "Reply added successfully",
      status: 201,
      success: true,
      data: reply,
    });
  } catch (error) {
    console.log(story, "errorrr in story reply.");
    return callback({
      message: "Something went wrong",
      status: 500,
      success: false,
      error: error.message,
    });
  }
};

export const seenStory = async (socket, payload, data, callback) => {
  const { id } = data;
  try {
    const storyData = await story.findFirst({
      where: { id: parseInt(id), is_deleted: false },
    });
    if (!storyData) {
      return callback({
        message: "Story not found",
        status: 404,
        success: false,
      });
    }
    if (storyData.user_id === payload.userId) {
      return callback({
        message: "You cannot mark your own story as seen",
        status: 400,
        success: false,
      });
    }

    const seenData = await prisma.$queryRaw`
        
        select user_id from story_seen where story_id = ${parseInt(id)} and user_id = ${payload.userId};
        
        `;

    console.log(seenData, "seenDataaaa....");

    if (seenData.length > 0) {
      return callback({
        message: "Story already marked as seen",
        status: 400,
        success: false,
      });
    }

    // Mark the story as seen by creating an entry in a hypothetical "story_views" table
    const seen = await prisma.story_seen.create({
      data: {
        story_id: parseInt(id),
        user_id: payload.userId,
        seen_at: new Date(),
      },
    });

    if (!seen) {
      throw new Error("Failed to mark the story as seen");
    }

    return callback({
      message: "Story marked as seen",
      status: 200,
      success: true,
    });
  } catch (error) {
    return callback({
      message: "Something went wrong",
      status: 500,
      success: false,

      error: error.message,
    });
  }
};

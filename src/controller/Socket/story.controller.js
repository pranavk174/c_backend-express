import prisma from "../../../prisma/prisma-client.js";
import { STORY_SEEN } from "../../utils/events.js";
import {
  getSocketmembers,
  getSockets,
  onlineUsers,
  userSocketIDs,
} from "../../utils/socket.helper.js";

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
  // console.log(payload, "payload data");
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

    const receiverSocketId = getSockets(storyData.user_id);
    const res = getSocketmembers(storyData.user_id);
    console.log(
      receiverSocketId,
      res,
      "receiver socket idddddd",

      onlineUsers,
      userSocketIDs,
    );

    seen.profile_pic = payload.profile_pic;
    seen.name = payload.name;
    socket.to(receiverSocketId).emit(STORY_SEEN, seen, (response) => {
      console.log("emitted datat in responseeee");
    });

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

export const likeStory = async (socket, payload, data, callback) => {
  const { id, like, reaction_id } = data;
  if (!id || like === null || like === undefined) {
    return {
      message: "Like value is required",
      status: 400,
      success: false,
    };
  }
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
        message: "You cannot like your own story",
        status: 400,
        success: false,
      });
    }

    const liked = await story_likes.upsert({
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

    if (!liked) {
      throw new Error("Failed to like the story");
    }

    return callback({
      message: `Story ${like === true ? "liked" : "unliked"} successfully`,
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

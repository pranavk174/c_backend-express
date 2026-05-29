import prisma from "../../../prisma/prisma-client.js";
import { validateToken } from "../../lib/tokenvalidator.js";

const { story, story_likes, chat, chat_member, message } = prisma;

const Storyresolver = {
  storyResponseData: {
    __resolveType(obj) {
      // multiple stories
      if (obj.stories) {
        return "StoriesData";
      }
      // single story — check key existence since text_data can be null
      if ("id" in obj) {
        return "StoryData";
      }
      return null;
    },
  },
  Query: {
    getStoryById: async (_, { id }, context) => {
      try {
        const payload = context.user;
        const storyData = await story.findFirst({
          where: {
            id: parseInt(id),
            user_id: payload.userId,
            is_deleted: false,
          },
        });

        const stories = await prisma.$queryRaw`
SELECT 
  s.*,

    COUNT(sl.story_id) AS likes_count

FROM story s

LEFT JOIN story_likes sl
ON s.id = sl.story_id

WHERE s.is_deleted = false AND s.user_id = ${payload.userId} AND s.expires_at > NOW()
GROUP BY s.id;
`;

        console.log(stories, "storiessss");

        // console.log(storyData, "dataaaaaaa.");
        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
        }

        return {
          message: "Story found",
          status: 200,
          success: true,
          data: storyData,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    getAllStories: async (_, __, context) => {
      try {
        const payload = context.user;
        //         const stories = await prisma.$queryRaw`
        //    SELECT
        //         s.*, u.name,

        //         CASE
        //         WHEN u.profile_pic IS NULL THEN NULL
        //         ELSE u.profile_pic
        //       END AS profile_pic,

        //         COUNT(DISTINCT sl.story_id) AS likes_count

        //     FROM story s

        //     LEFT JOIN story_likes sl
        //     ON sl.story_id = s.id

        //     left join users u on
        //     u.id = s.user_id

        //     WHERE

        //         -- =====================================
        //         -- STORY BASIC FILTERS
        //         -- =====================================

        //         s.is_deleted = false

        //         AND s.expires_at > NOW()

        //         -- =====================================
        //         -- BLOCK CHECK
        //         -- =====================================

        //         AND NOT EXISTS (

        //             SELECT 1

        //             FROM block bu

        //             WHERE

        //             (
        //                 bu.user_id = s.user_id
        //                 AND bu.blocked_user_id = ${payload.userId}
        //             )

        //             OR

        //             (
        //                 bu.user_id = ${payload.userId}
        //                 AND bu.blocked_user_id = s.user_id
        //             )

        //         )

        //         -- =====================================
        //         -- PRIVACY LOGIC
        //         -- =====================================

        //         AND (

        //             -- =================================
        //             -- OWN STORIES
        //             -- =================================

        //             s.user_id = ${payload.userId}

        //             -- =================================
        //             -- PUBLIC STORIES
        //             -- =================================

        //             OR EXISTS (

        //                 SELECT 1

        //                 FROM privacy_settings ps

        //                 WHERE

        //                 ps.user_id = s.user_id

        //                 AND ps.entity_type :: text = 'STORY'

        //                 AND ps.privacy_type ::text = 'PUBLIC'

        //             )

        //             -- =================================
        //             -- ONLY ME
        //             -- =================================

        //             OR EXISTS (

        //                 SELECT 1

        //                 FROM privacy_settings ps

        //                 WHERE

        //                 ps.user_id = s.user_id

        //                 AND ps.entity_type :: text = 'STORY'

        //                 AND ps.privacy_type  :: text = 'ONLY_ME'

        //                 AND s.user_id = ${payload.userId}

        //             )

        //             -- =================================
        //             -- CUSTOM
        //             -- =================================

        //             OR EXISTS (

        //                 SELECT 1

        //                 FROM privacy_settings ps

        //                 JOIN privacy_user pu
        //                 ON pu.privacy_id = ps.privacy_id

        //                 WHERE

        //                 ps.user_id = s.user_id

        //                 AND ps.entity_type  :: text = 'STORY'

        //                 AND ps.privacy_type  :: text = 'CUSTOM'

        //                 AND pu.target_user_id = ${payload.userId}

        //             )

        //             -- =================================
        //             -- EXCEPT USERS
        //             -- =================================

        //             OR (

        //                 EXISTS (

        //                     SELECT 1

        //                     FROM privacy_settings ps

        //                     WHERE

        //                     ps.user_id = s.user_id

        //                     AND ps.entity_type  :: text = 'STORY'

        //                     AND ps.privacy_type  :: text = 'EXCEPT_USERS'

        //                 )

        //                 AND NOT EXISTS (

        //                     SELECT 1

        //                     FROM privacy_settings ps

        //                     JOIN privacy_user pu
        //                     ON pu.privacy_id = ps.privacy_id

        //                     WHERE

        //                     ps.user_id = s.user_id

        //                     AND ps.entity_type  :: text = 'STORY'

        //                     AND ps.privacy_type  :: text = 'EXCEPT_USERS'

        //                     AND pu.target_user_id = ${payload.userId}

        //                 )

        //             )

        //         )

        //     GROUP BY s.id,u.name,u.profile_pic

        //     ORDER BY s.created_at DESC;
        // `;

        const myStories = await prisma.$queryRaw`

SELECT 
    s.id,
s.text_data,
s.user_id,
    s.content,
    s.created_at,

    u.name,
    u.profile_pic,

    COALESCE(
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(

                'id', interaction_user.id,
                'name', interaction_user.name,
                'profile_pic', interaction_user.profile_pic,

                'liked', interactions.liked,
                'liked_at', interactions.liked_at,

                'seen', interactions.seen,
                'seen_at', interactions.seen_at

            )
        ) FILTER (WHERE interaction_user.id IS NOT NULL),
        '[]'
    ) AS interactions

FROM story s

LEFT JOIN users u
ON u.id = s.user_id

LEFT JOIN (

    SELECT
        COALESCE(sl.story_id, sn.story_id) AS story_id,
        COALESCE(sl.user_id, sn.user_id) AS user_id,

        CASE 
            WHEN sl.user_id IS NOT NULL THEN true
            ELSE false
        END AS liked,

        sl.created_at AS liked_at,

        CASE
            WHEN sn.user_id IS NOT NULL THEN true
            ELSE false
        END AS seen,

        sn.seen_at AS seen_at

    FROM story_likes sl

    FULL OUTER JOIN story_seen sn
    ON sl.story_id = sn.story_id
    AND sl.user_id = sn.user_id

) interactions
ON interactions.story_id = s.id

LEFT JOIN users interaction_user
ON interaction_user.id = interactions.user_id

WHERE s.user_id = ${payload.userId}     AND s.expires_at > NOW()

GROUP BY s.id, u.id

ORDER BY
    s.created_at DESC;

`;

        // console.log(JSON.stringify(myStories, null, 2), "my SToriessssss");

        const stories = await prisma.$queryRaw`
SELECT 
    s.*,
    u.name,
    u.profile_pic,
    

    COUNT(DISTINCT sl.story_id) AS likes_count

FROM story s

LEFT JOIN story_likes sl
ON sl.story_id = s.id

LEFT JOIN users u
ON u.id = s.user_id

WHERE

    -- active stories
    s.is_deleted = false
 and
    s.user_id <> ${payload.userId}

    AND s.expires_at > NOW()

    -- block logic
    AND NOT EXISTS (

        SELECT 1
        FROM block b

        WHERE

        (
            b.user_id = s.user_id
            AND b.blocked_user_id = ${payload.userId}
        )

        OR

        (
            b.user_id = ${payload.userId}
            AND b.blocked_user_id = s.user_id
        )

    )


GROUP BY
    s.id,
    u.name,
    u.profile_pic

ORDER BY
    s.created_at DESC;
`;

        const grouped = stories.reduce((acc, story) => {
          if (!acc[story.user_id]) {
            acc[story.user_id] = {
              user_id: story.user_id,
              name: story.name,
              profile_pic: story.profile_pic,
              isOwn: story.user_id === payload.userId,
              stories: [],
            };
          }

          acc[story.user_id].stories.push({
            id: story.id,
            text_data: story.text_data,
            content: story.content,
            created_at: story.created_at,
          });

          return acc;
        }, {});

        const grouped2 = myStories.reduce((acc, story) => {
          if (!acc[story.user_id]) {
            acc[story.user_id] = {
              user_id: story.user_id,
              name: story.name,
              profile_pic: story.profile_pic,
              isOwn: story.user_id === payload.userId,
              stories: [],
            };
          }

          acc[story.user_id].stories.push({
            id: story.id,
            text_data: story.text_data,
            content: story.content,
            created_at: story.created_at,

            interactions: story.interactions || [],
          });

          return acc;
        }, {});

        console.log(JSON.stringify(Object.values(grouped2), null, 2));
        return {
          message: "Stories retrieved successfully",
          status: 200,
          success: true,
          data: {
            __resolveType: "Storiesdata",
            stories: [...Object.values(grouped2), ...Object.values(grouped)],
          },
        };
      } catch (error) {
        console.log(error, "errpor");
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
  },
  Mutation: {
    createStory: async (
      _,
      { input: { content, text_data, message_ids = [] } },
      context,
    ) => {
      if ((!content || content.trim() === "") && message_ids.length === 0) {
        return {
          message: "Content is required",
          status: 400,
        };
      }
      try {
        const payload = context.user;

        if (message_ids.length > 0) {
          const media = await prisma.$queryRaw`
          
          select * from attachment where message_id = ANY(${message_ids})
          
          `;

          const data = await prisma.story.createMany({
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
          const storyData = await story.create({
            data: {
              content,
              text_data,
              user_id: payload.userId,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours ke liye valid
            },
          });

          if (!storyData) {
            throw new Error("Story Creation Failed");
          }
        }
        return {
          message: "Story created successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error, "errrorrrr in creating story...");
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    likeStory: async (_, { input: { id, like, reaction_id } }, context) => {
      if (!id || like === null || like === undefined) {
        return {
          message: "Like value is required",
          status: 400,
          success: false,
        };
      }
      try {
        const payload = context.user;

        const storyData = await story.findFirst({
          where: { id: parseInt(id), is_deleted: false },
        });
        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
        }

        if (storyData.user_id === payload.userId) {
          return {
            message: "You cannot like your own story",
            status: 400,
            success: false,
          };
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

        return {
          message: `Story ${like === true ? "liked" : "unliked"} successfully`,
          status: 200,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    seenStory: async (_, { id }, context) => {
      if (!id) {
        return {
          message: "Story ID is required",
          status: 400,
          success: false,
        };
      }
      try {
        const payload = context.user;
        const storyData = await story.findFirst({
          where: { id: parseInt(id), is_deleted: false },
        });
        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
        }
        if (storyData.user_id === payload.userId) {
          return {
            message: "You cannot mark your own story as seen",
            status: 400,
            success: false,
          };
        }

        const seenData = await prisma.$queryRaw`
        
        select user_id from story_seen where story_id = ${parseInt(id)} and user_id = ${payload.userId};
        
        `;

        console.log(seenData, "seenDataaaa....");

        if (seenData.length > 0) {
          return {
            message: "Story already marked as seen",
            status: 400,
            success: false,
          };
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

        return {
          message: "Story marked as seen",
          status: 200,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,

          error: error.message,
        };
      }
    },
    replyToStory: async (_, { id, content }, context) => {
      if (!content || content.trim() === "") {
        return {
          message: "Content is required",
          status: 400,
          success: false,
        };
      }
      try {
        const payload = context.user;

        console.log(payload, "payloadddddd");
        const storyData = await story.findFirst({
          where: { id: parseInt(id), is_deleted: false },
        });
        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
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

        return {
          message: "Reply added successfully",
          status: 201,
          success: true,
          data: reply,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    forwardStory: async (
      _,
      { input: { storyId, targets, message } },
      context,
    ) => {
      if (!targets || targets.length === 0) {
        return {
          message: "At least one target is required",
          status: 400,
          success: false,
        };
      }
      try {
        const payload = context.user;
        const storyData = await story.findFirst({
          where: { id: parseInt(storyId), is_deleted: false },
        });

        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
        }

        const forwarded = await Promise.all(
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
                const forward = await prisma.$queryRaw`
                insert into message (
                  chat_id ,sender_id ,content ,story_id, created_at) values(${parseInt(chatData.id)} , ${parseInt(payload.userId)} , ${message}, ${parseInt(storyData.id)}, NOW()
                )
                `;
              } else {
                const forward = await prisma.$queryRaw`
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
                throw new Error("You are not a member of the target group");
              }

              const forward = await prisma.$queryRaw`
                insert into message (
                  chat_id ,sender_id ,content ,story_id, created_at) values(${parseInt(target.chatId)} , ${parseInt(payload.userId)} , ${message}, ${parseInt(storyData.id)}, NOW()
                )
                `;
            }
          }),
        );

        if (forwarded.length === 0) {
          throw new Error("Failed to forward story to any recipient");
        }

        return {
          message: "Story forwarded successfully",
          status: 200,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    deleteStory: async (_, { id }, context) => {
      try {
        const payload = context.user;
        const storyData = await story.findFirst({
          where: { id: parseInt(id), is_deleted: false },
        });
        if (!storyData) {
          return {
            message: "Story not found",
            status: 404,
            success: false,
          };
        }
        if (storyData.user_id !== payload.userId) {
          return {
            message: "You can only delete your own story",
            status: 403,
            success: false,
          };
        }
        const deleted = await story.update({
          where: { id: parseInt(id) },
          data: { is_deleted: true },
        });

        if (!deleted) {
          throw new Error("Failed to delete the story");
        }
        return {
          message: "Story deleted successfully",
          status: 200,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
  },
};

export default Storyresolver;

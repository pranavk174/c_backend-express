import { AppError } from "../../../lib/errorHandler.js";
import prisma from "../../../../prisma/prisma-client.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";
import { logger } from "../../../utils/logger.js";

const { story } = prisma;

export const getStoryByIdQuery = asyncGraphqlAPIHandeler(
  async (_, { id }, context) => {
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

    logger.debug(stories, "storiessss");

    // logger.debug(storyData, "dataaaaaaa.");
    if (!storyData) {
      throw new AppError({
        message: "Story not found",
        status: 404,
        code: "NOT_FOUND_ERROR",
      });
    }

    return {
      message: "Story found",
      status: 200,
      success: true,
      data: storyData,
    };
  },
);

export const getAllStoriesQuery = asyncGraphqlAPIHandeler(
  async (_, __, context) => {
    const payload = context.user;

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
            WHEN sl.user_id IS NOT NULL  THEN sl.liked
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

    // logger.debug(JSON.stringify(myStories, null, 2), "my SToriessssss");

    const stories = await prisma.$queryRaw`
SELECT 
    s.*,
    u.name,
    u.profile_pic,

     COALESCE(
    (
        SELECT sl.liked
        FROM story_likes sl
        WHERE sl.story_id = s.id
        AND sl.user_id = ${payload.userId}
        LIMIT 1
    ),
    false
) AS liked,

    EXISTS (
        SELECT 1
        FROM story_seen sn
        WHERE sn.story_id = s.id
        AND sn.user_id = ${payload.userId}
    ) AS seen




FROM story s



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
            AND b.blocked_user_id = ${payload.userId} AND b.blocked = true 
        )

        OR

        (
            b.user_id = ${payload.userId}
            AND b.blocked_user_id = s.user_id AND b.blocked = true
        )
        AND s.created_at >= b.blocked_at
        AND (
          b.unblocked_at IS NULL
          OR
          s.created_at <= b.unblocked_at
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
        seen: story.seen,
        liked: story.liked,
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

    // logger.debug(stories);
    return {
      message: "Stories retrieved successfully",
      status: 200,
      success: true,
      data: {
        __resolveType: "Storiesdata",
        stories: [...Object.values(grouped2), ...Object.values(grouped)],
      },
    };
  },
);

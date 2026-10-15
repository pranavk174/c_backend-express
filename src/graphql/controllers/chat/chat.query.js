import { BadRequestError } from "../../../lib/errorHandler.js";
import { Prisma } from "@prisma/client";
import prisma from "../../../../prisma/prisma-client.js";
import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";

import { onlineUsers } from "../../../utils/socket.helper.js";
export const getChatByIdQuery = asyncGraphqlAPIHandeler(
  async (_, { input: { chat_ids, cursor = null, limit = 20 } }, ctx) => {
    const payload = ctx.user;

    const parsedCursor = cursor ? Number(cursor) : null;
    if (chat_ids.length < 1) {
      return {
        message: "Chat Id is missing!",
        status: 404,
        success: false,
      };
    }

    const chat_id = chat_ids[0];

    const chats = await prisma.$queryRaw`

SELECT 
    m.id,

    CASE
        WHEN md.message_id = m.id
         AND md.user_id = ${payload.userId}
        THEN 'Deleted message'

        ELSE m.content
    END AS content,

    CASE
        WHEN md.message_id = m.id
         AND md.user_id = ${payload.userId}
        THEN null

        else a.url
    end as preview,

    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN null
    else m.story_id
    end as story_id ,



    m.chat_id,
    m.sender_id,

    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN NULL
    else 
st.content end as story_item ,

    m.created_at,
    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN false
    else 
    m.is_forwarded end as is_forwarded,

    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN false
    else 
    m.is_edited end as is_edited
    ,
    m.is_deleted,

    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN NULL
    else 
    m.reply_to_message_id end as reply_to_message_id,

    COALESCE(seen.seen_users, '{}') as seen_users,

    CASE
    WHEN md.message_id = m.id
     AND md.user_id = ${payload.userId}
    THEN '[]'::json
    else 
    COALESCE(r.reactions, '[]'::json) end as reactions 

FROM message m

LEFT JOIN LATERAL (

    SELECT ARRAY_AGG(sm.user_id) as seen_users

    FROM seen_message sm

    WHERE sm.message_id = m.id

) seen ON true


left join story st 
  on st.id = m.story_id

LEFT JOIN message_delete_for_me md
ON m.id = md.message_id

LEFT JOIN attachment a
ON a.message_id = m.id

LEFT JOIN LATERAL (

    SELECT json_agg(
        json_build_object(
            'react_id', mr.reaction_id,
            'user_id', ru.id
        )
    ) as reactions

    FROM message_reaction mr

    JOIN users ru
    ON ru.id = mr.user_id

    WHERE mr.message_id = m.id

) r ON true

WHERE 
    m.chat_id = ${chat_id}

    AND m.is_deleted = false

    AND NOT EXISTS (

        SELECT 1

        FROM block b

        WHERE
        (
            (
                b.user_id = ${payload.userId}
                AND b.blocked_user_id = m.sender_id
            )

            OR

            (
                b.user_id = m.sender_id
                AND b.blocked_user_id = ${payload.userId}
            )
        )

        AND m.created_at >= b.blocked_at

        AND (
            b.unblocked_at IS NULL
            OR
            m.created_at <= b.unblocked_at
        )
    )

    ${cursor ? Prisma.sql`AND m.id < ${parsedCursor}` : Prisma.empty}

ORDER BY m.id DESC

LIMIT ${limit}

`;

    // console.dir(chats, { depth: null });

    const formattedChats = [...chats].reverse();

    const nextCursor = chats.length > 0 ? chats[chats.length - 1].id : null;
    // logger.debug(JSON.stringify(formattedChats, null, 2));
    // logger.debug(formattedChats)

    return {
      message: "Successfully retrieved Chat",
      status: 200,
      success: true,
      data: {
        _responseType: "SingleChat",
        items: formattedChats,
        nextCursor,
        hasMore: chats.length === limit,
      },
    };
  },
);

export const getAllChatsQuery = asyncGraphqlAPIHandeler(async (_, __, ctx) => {
  const payload = ctx.user;

  const [chats, groups] = await Promise.all([
    prisma.$queryRaw`

SELECT DISTINCT ON (c.id)

    c.id AS chat_id,
    c.chat_type,

    u.id AS user_id,
    u.name,

    CASE 
        WHEN active_block.user_id = ${payload.userId}
        THEN true

        ELSE false::boolean
    END as blocked,
  
   
    CASE 
        WHEN active_block.blocked_user_id = ${payload.userId}
        THEN 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png'

        ELSE u.profile_pic
    END as profile_pic,

    CASE 
        WHEN active_block.blocked_user_id = ${payload.userId}
        THEN ''

        ELSE u.bio
    END as bio,

    u.email as email,
    u.mobile as mobile,

    m.id AS last_message_id,


unread.unread_count ,

    CASE 
        WHEN m.content IS NULL 
        THEN a.file_type::text

        ELSE m.content
    END AS last_message,

    m.created_at AS last_message_at

FROM chat c

JOIN chat_member cm
ON cm.chat_id = c.id

JOIN users u
ON u.id = cm.member_id

LEFT JOIN LATERAL (

    SELECT *
    FROM block b

    WHERE
    (
        (
            b.user_id = ${payload.userId}
            AND b.blocked_user_id = u.id
        )

        OR

        (
            b.user_id = u.id
            AND b.blocked_user_id = ${payload.userId}
        )
    )

    AND b.unblocked_at IS NULL

    ORDER BY b.blocked_at DESC

    LIMIT 1

) active_block ON true



LEFT JOIN LATERAL (

    SELECT COUNT(*)::int AS unread_count

    FROM message msg

    WHERE msg.chat_id = c.id
      AND msg.sender_id <> ${payload.userId}
      AND msg.is_deleted = false

      AND NOT EXISTS (
          SELECT 1
          FROM seen_message sm
          WHERE sm.message_id = msg.id 
            AND sm.user_id = ${payload.userId}
      )

) unread ON true

LEFT JOIN LATERAL (

    SELECT *

    FROM message message

    WHERE 
        message.chat_id = c.id 
        AND message.is_deleted = false

        AND NOT EXISTS (

            SELECT 1

            FROM block b

            WHERE
            (
    
                (
                    b.user_id = ${payload.userId}
                    AND b.blocked_user_id = message.sender_id
                )

                OR

                (
                    b.user_id = message.sender_id
                    AND b.blocked_user_id = ${payload.userId}
                )
            )

            AND message.created_at >= b.blocked_at

            AND (
                b.unblocked_at IS NULL
                OR
                message.created_at <= b.unblocked_at
            )
        )

        AND NOT EXISTS (
            SELECT 1
            FROM message_delete_for_me md
            WHERE md.message_id = message.id
            AND md.user_id = ${payload.userId}
        )

    ORDER BY message.created_at DESC

    LIMIT 1

) m ON true





LEFT JOIN attachment a
ON a.message_id = m.id
AND m.content IS NULL

WHERE c.id IN (
    SELECT chat_id
    FROM chat_member
    WHERE member_id = ${payload.userId} 

)

AND u.id != ${payload.userId}
and c.chat_type <> 'group'

ORDER BY c.id, m.created_at DESC NULLS LAST;

`,
    prisma.$queryRaw`
SELECT
    g.name,
    g.chat_id,
    g.created_by_id,

    c.chat_type,
    CASE
        WHEN g.profile_pic IS NULL
        THEN 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png'
        ELSE g.profile_pic
    END AS profile_pic,

    unread.unread_count,

    m.id AS last_message_id,

    CASE
        WHEN m.content IS NULL
        THEN a.file_type::text
        ELSE m.content
    END AS last_message,


    

    m.created_at AS last_message_at

FROM groups g

JOIN chat_member my_membership
  ON my_membership.chat_id = g.chat_id
 AND my_membership.member_id = ${payload.userId}

JOIN chat c
  ON c.id = g.chat_id




LEFT JOIN LATERAL (
    SELECT *
    FROM message m
    WHERE m.chat_id = g.chat_id
      AND m.is_deleted = false
    ORDER BY m.created_at DESC
    LIMIT 1
) m ON true

LEFT JOIN attachment a
  ON a.message_id = m.id
 AND m.content IS NULL

LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS unread_count
    FROM message msg
    WHERE msg.chat_id = g.chat_id
      AND msg.sender_id <> ${payload.userId}
      AND msg.is_deleted = false
      AND NOT EXISTS (
          SELECT 1
          FROM seen_message sm
          WHERE sm.message_id = msg.id
            AND sm.user_id = ${payload.userId}
      )
) unread ON true

ORDER BY m.created_at DESC NULLS LAST;
`,
  ]);
  // logger.debug("group", groups);
  const newChats = chats.reduce((arr, idx) => {
    const online = onlineUsers.has(idx.user_id.toString());
    // logger.debug(
    //   online,
    //   " isOnline dataaaaa",
    //   onlineUsers,
    //   chatSocketIds,
    //   // idx,
    // );
    arr.push({ ...idx, isOnline: online });
    return arr;
  }, []);

  // logger.debug(newChats, "chatsssssss");

  return {
    message: "Successfully retrieved Chat",
    status: 200,
    success: true,
    data: {
      _responseType: "AllChats",
      items: [...newChats, ...groups].sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at),
      ),
      // items: chats,
    },
  };
});

export const getAllMembersQuery = asyncGraphqlAPIHandeler(
  async (_, { input: { chat_ids } }, ctx) => {
    // logger.debug(chat_ids, "chat idssss");
    if (chat_ids.length === 0) {
      throw new BadRequestError("Chat id is missing");
    }
    const chat_id = chat_ids[0];
    const members = await prisma.chat_member.findMany({
      where: {
        chat_id: chat_id,
      },
      select: {
        member_id: true,
        role: true,
      },
    });

    // logger.debug(members, "memebrsssss");
    return {
      data: {
        _responseType: "members",
        items: members,
      },
      message: "success",
      success: true,
      status: 200,
    };
  },
);

export const getEmojisQuery = asyncGraphqlAPIHandeler(async () => {
  const data = await prisma.$queryRaw`
        
        select react_id , emoji from reaction
        
        `;

  // logger.debug(data, "dataaaaaa");

  return {
    message: "Data get Successs",
    success: true,
    data: {
      _responseType: "Emojis",
      items: data,
    },
    status: 200,
  };
});

export const getWallPaperQuery = asyncGraphqlAPIHandeler(async (_, __, ctx) => {
  const payload = ctx.user;

  const wallpaper = await prisma.$queryRaw`
        
        select url from wallpapers where user_id = ${payload.userId} 
        
        `;

  if (wallpaper.length === 0) {
    return {
      message: "No Wallpaper Found",
      status: 200,
      success: false,
    };
  }
  const url = wallpaper[0].url;
  return {
    message: "Success fully retrieved data",
    status: 200,
    success: true,
    data: {
      _responseType: "Wallpaper",
      url,
    },
  };
});

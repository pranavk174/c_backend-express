import prisma from "../../../prisma/prisma-client.js";
import { Prisma } from "@prisma/client";
import { pubsub } from "../../lib/helpers.js";
import { validateToken } from "../../lib/tokenvalidator.js";
import {
  checkChatExists,
  checkMemeberExists,
  checkMessageExists,
  chekUserExists,
} from "../../lib/helpers.js";
import { GraphQLError } from "graphql";
import { chatSocketIds, onlineUsers } from "../../utils/socket.helper.js";
const chatResolver = {
  ChatResponse: {
    __resolveType(obj) {
      // console.log(obj, "object dataaa");
      if (obj._responseType === "Emojis") {
        return "Emojis";
      } else if (obj._responseType === "SingleChat") {
        return "SingleChat";
      } else if (obj._responseType === "newChat") {
        return "newChat";
      } else if (obj._responseType === "AllChats") {
        return "AllChats";
      } else if (obj._responseType === "members") {
        return "members";
      } else if (obj._responseType === "Wallpaper") {
        return "Wallpaper";
      }
      return obj._responseType;
    },
  },
  Query: {
    getChatById: async (
      _,
      { input: { chat_ids, cursor = null, limit = 20 } },
      ctx,
    ) => {
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

      try {
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

        if (!chats) {
          throw new Error();
        }

        const formattedChats = [...chats].reverse();

        const nextCursor = chats.length > 0 ? chats[chats.length - 1].id : null;
        // console.log(JSON.stringify(formattedChats, null, 2));
        // console.log(formattedChats)

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
      } catch (err) {
        console.log(err);
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    getMembers: async (_, { input: { chat_ids } }, ctx) => {
      const payload = ctx;

      try {
        console.log(chat_ids, "chat idssss");
        if (chat_ids.length === 0) {
          throw new Error("Chat id is missing");
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

        console.log(members, "memebrsssss");
        return {
          data: {
            _responseType: "members",
            items: members,
          },
          message: "success",
          success: true,
          status: 200,
        };
      } catch (error) {
        return {
          error: error.message,
          message: "Something went wrong",
          success: false,
          status: 500,
        };
      }
    },
    getAllChats: async (_, __, ctx) => {
      const payload = ctx.user;

      try {
        //         const chats = await prisma.$queryRaw`

        // SELECT DISTINCT ON (c.id)

        //     c.id AS chat_id,
        //     c.chat_type,

        //     u.id AS user_id,
        //     u.name,

        //     CASE
        //         WHEN active_block.user_id = ${payload.userId}
        //         THEN true

        //         ELSE false::boolean
        //     END as blocked,

        //     u.cover_pic,
        //     CASE
        //         WHEN active_block.blocked_user_id = ${payload.userId}
        //         THEN 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png'

        //         ELSE u.profile_pic
        //     END as profile_pic,

        //     CASE
        //         WHEN active_block.blocked_user_id = ${payload.userId}
        //         THEN ''

        //         ELSE u.bio
        //     END as bio,

        //     u.email as email,
        //     u.mobile as mobile,

        //     m.id AS last_message_id,

        // unread.unread_count ,

        //     CASE
        //         WHEN m.content IS NULL
        //         THEN a.file_type::text

        //         ELSE m.content
        //     END AS last_message,

        //     m.created_at AS last_message_at

        // FROM chat c

        // JOIN chat_member cm
        // ON cm.chat_id = c.id

        // JOIN users u
        // ON u.id = cm.member_id

        // LEFT JOIN LATERAL (

        //     SELECT *
        //     FROM block b

        //     WHERE
        //     (
        //         (
        //             b.user_id = ${payload.userId}
        //             AND b.blocked_user_id = u.id
        //         )

        //         OR

        //         (
        //             b.user_id = u.id
        //             AND b.blocked_user_id = ${payload.userId}
        //         )
        //     )

        //     AND b.unblocked_at IS NULL

        //     ORDER BY b.blocked_at DESC

        //     LIMIT 1

        // ) active_block ON true

        // LEFT JOIN LATERAL (

        //     SELECT COUNT(*)::int AS unread_count

        //     FROM message msg

        //     WHERE msg.chat_id = c.id
        //       AND msg.sender_id <> ${payload.userId}
        //       AND msg.is_deleted = false

        //       AND NOT EXISTS (
        //           SELECT 1
        //           FROM seen_message sm
        //           WHERE sm.message_id = msg.id
        //             AND sm.user_id = ${payload.userId}
        //       )

        // ) unread ON true

        // LEFT JOIN LATERAL (

        //     SELECT *

        //     FROM message message

        //     WHERE
        //         message.chat_id = c.id
        //         AND message.is_deleted = false

        //         AND NOT EXISTS (

        //             SELECT 1

        //             FROM block b

        //             WHERE
        //             (

        //                 (
        //                     b.user_id = ${payload.userId}
        //                     AND b.blocked_user_id = message.sender_id
        //                 )

        //                 OR

        //                 (
        //                     b.user_id = message.sender_id
        //                     AND b.blocked_user_id = ${payload.userId}
        //                 )
        //             )

        //             AND message.created_at >= b.blocked_at

        //             AND (
        //                 b.unblocked_at IS NULL
        //                 OR
        //                 message.created_at <= b.unblocked_at
        //             )
        //         )

        //         AND NOT EXISTS (
        //             SELECT 1
        //             FROM message_delete_for_me md
        //             WHERE md.message_id = message.id
        //             AND md.user_id = ${payload.userId}
        //         )

        //     ORDER BY message.created_at DESC

        //     LIMIT 1

        // ) m ON true

        // LEFT JOIN attachment a
        // ON a.message_id = m.id
        // AND m.content IS NULL

        // WHERE c.id IN (
        //     SELECT chat_id
        //     FROM chat_member
        //     WHERE member_id = ${payload.userId}
        // )

        // AND u.id != ${payload.userId}

        // ORDER BY c.id, m.created_at DESC NULLS LAST;

        // `;

        //         const groups = await prisma.$queryRaw`
        // SELECT
        //     g.name,
        //     g.chat_id,
        //     g.created_by_id,

        //     c.chat_type,
        //     CASE
        //         WHEN g.profile_pic IS NULL
        //         THEN 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png'
        //         ELSE g.profile_pic
        //     END AS profile_pic,

        //     unread.unread_count,

        //     m.id AS last_message_id,

        //     CASE
        //         WHEN m.content IS NULL
        //         THEN a.file_type::text
        //         ELSE m.content
        //     END AS last_message,

        //     m.created_at AS last_message_at

        // FROM groups g

        // JOIN chat_member my_membership
        //   ON my_membership.chat_id = g.chat_id
        //  AND my_membership.member_id = ${payload.userId}

        // JOIN chat c
        //   ON c.id = g.chat_id

        // LEFT JOIN LATERAL (
        //     SELECT *
        //     FROM message m
        //     WHERE m.chat_id = g.chat_id
        //       AND m.is_deleted = false
        //     ORDER BY m.created_at DESC
        //     LIMIT 1
        // ) m ON true

        // LEFT JOIN attachment a
        //   ON a.message_id = m.id
        //  AND m.content IS NULL

        // LEFT JOIN LATERAL (
        //     SELECT COUNT(*)::int AS unread_count
        //     FROM message msg
        //     WHERE msg.chat_id = g.chat_id
        //       AND msg.sender_id <> ${payload.userId}
        //       AND msg.is_deleted = false
        //       AND NOT EXISTS (
        //           SELECT 1
        //           FROM seen_message sm
        //           WHERE sm.message_id = msg.id
        //             AND sm.user_id = ${payload.userId}
        //       )
        // ) unread ON true

        // ORDER BY m.created_at DESC NULLS LAST;
        // `;

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

    u.cover_pic,
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
        // console.log("group", groups);
        const newChats = chats.reduce((arr, idx) => {
          const online = onlineUsers.has(idx.user_id.toString());
          console.log(
            online,
            " isOnline dataaaaa",
            onlineUsers,
            chatSocketIds,
            // idx,
          );
          arr.push({ ...idx, isOnline: online });
          return arr;
        }, []);

        // console.log(newChats, "chatsssssss");

        if (!chats) {
          throw new Error();
        }
        return {
          message: "Successfully retrieved Chat",
          status: 200,
          success: true,
          data: {
            _responseType: "AllChats",
            items: [...newChats, ...groups].sort(
              (a, b) =>
                new Date(b.last_message_at) - new Date(a.last_message_at),
            ),
            // items: chats,
          },
        };
      } catch (error) {
        console.log(error, "errorrrr ");
        return {
          message: "Something went wrong",
          status: 500,
          error: error.message,
          success: false,
        };
      }
    },
    getEmojis: async (_, __, ctx) => {
      try {
        const data = await prisma.$queryRaw`
        
        select react_id , emoji from reaction
        
        `;

        // console.log(data, "dataaaaaa");

        return {
          message: "Data get Successs",
          success: true,
          data: {
            _responseType: "Emojis",
            items: data,
          },
          status: 200,
        };
      } catch (err) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    getWallPaper: async (_, __, ctx) => {
      try {
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
      } catch (error) {}
    },
  },
  Mutation: {
    createNewChat: async (_, { member_id }, ctx) => {
      if (!member_id) {
        throw new Error("Member id is Missing");
      }
      try {
        const payload = ctx.user;

        let chat_id = null;
        const exists = await checkChatExists(prisma, payload.userId, [
          member_id,
        ]);

        if (exists.length === 0) {
          const newChat = await prisma.$queryRaw`
          
          insert into chat (chat_type) values('private') returning id
          
          
          `;
          if (!newChat) {
            throw new Error();
          }

          chat_id = newChat[0].id;

          // const values = Prisma.sql`(${newChat[0].id}, ${payload.userId}),(${newChat[0].id}, ${member_id})`;

          const members = await prisma.$queryRaw`
          
          
          insert into chat_member (chat_id , member_id)
          values  (${newChat[0].id}, ${payload.userId}),
          (${newChat[0].id}, ${member_id})
          `;
        } else {
          chat_id = exists[0].chat_id;
        }

        return {
          message: "Chat Created Successfully",
          status: 201,
          success: true,
          data: {
            _responseType: "newChat",
            chat_id,
          },
        };
      } catch (error) {
        return {
          message: error.message,
          status: 500,
          success: false,
        };
      }
    },
    createNewGroup: async (
      _,
      { input: { member_ids, groupName, profile_pic = null } },
      ctx,
    ) => {
      const payload = ctx.user;
      try {
        // if (member_ids.length <= 1) {
        //   return {
        //     message: "Group Can not have only One member",
        //     success: false,
        //     status: 400,
        //   };
        // }

        const result = await prisma.$transaction(async (tx) => {
          const created = await tx.$queryRaw`
      
      insert into chat (chat_type) values('group') returning id ;
      
      `;

          if (!created) throw new Error("Error in creanting Chat id");

          await tx.$queryRaw`
      insert into groups (name , chat_id ,profile_pic,created_by_id) values (${groupName},${created[0].id},${profile_pic},${payload.userId});
      `;

          const members = [
            ...member_ids.map(
              (id) => Prisma.sql` (${created[0].id}, ${id} , 'member') `,
            ),
            Prisma.sql`  (${created[0].id} , ${payload.userId} , 'admin')
      `,
          ];

          await tx.$queryRaw`
      insert into chat_member (chat_id , member_id , role) values ${Prisma.join(members)}
      `;

          return created[0];
        });

        if (result) {
          return {
            message: "Successfully created Group",
            status: 201,
            success: true,
          };
        } else {
          throw new Error();
        }
      } catch (error) {
        console.log(error);
        return {
          message: "Error in group Creation",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    sendMessage: async (
      _,
      { input: { chat_ids, reciever_ids, content = null, media = [] } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (
        (!content && !media) ||
        (chat_ids &&
          chat_ids.length < 1 &&
          reciever_ids &&
          reciever_ids.length < 1)
      ) {
        return {
          message: "Data is missing...",
          status: 400,
          success: false,
        };
      }

      // if(reciever_ids && reciever_ids.incldes(payload.userID))

      let chatId = null;
      let chat_id = null;
      if (chat_ids && chat_ids.length > 0) {
        chatId = chat_ids[0];
        chat_id = chat_ids[0];
      }

      try {
        if (!chat_id) {
          const reciever_id = parseInt(reciever_ids[0]);
          const reciever = await chekUserExists(prisma, reciever_ids);

          // console.log(typeof reciever_id, "type dataaa...");
          if (!reciever.length > 0) {
            throw new Error("Reciever Does not exists");
          }
          // const memeberExists = await checkMemeberExists(prisma, reciever_ids);

          const chatExists = await checkChatExists(
            prisma,
            payload.userId,
            reciever_ids,
          );

          if (chatExists.length < 1) {
            const data = await prisma.$queryRaw`
          
          insert into chat (chat_type) values('private')  RETURNING id;


          `;

            if (!data || data.length < 1) {
              throw new Error();
            }
            chatId = data[0].id;

            const chatmember = await prisma.$queryRaw`
          
          insert into chat_member (member_id ,chat_id ) values(${payload.userId},${chatId}),(${reciever_id},${chatId})
          
          `;
            if (!chatmember) {
              throw new Error();
            }
          }
          console.log(chatExists, "chartexistssssss");

          chatId = chatExists[0].chat_id;
        }
        const addMessage = await prisma.$queryRaw`
          
          insert into message (content,sender_id ,created_at ,chat_id )  values(${content},${payload.userId},${new Date()},${chat_id ?? chatId}) returning *
          
          `;

        if (media && media.length > 0) {
          const [addMedia] = await Promise.all(
            media.map((m) => {
              return prisma.$queryRaw`

          insert into attachment (message_id,url,file_type,file_name,file_size) values(${addMessage[0].id},${m.url},${m.file_type.toLowerCase()},${m.file_name},${m.file_size})

          `;
            }),
          );

          if (!addMedia) {
            throw new Error();
          }
        }

        // console.log(chatId, "chatiddddd");

        if (!addMessage) {
          throw new Error();
        }

        console.log(addMessage, "addmessage dataaa");

        await pubsub.publish(`CHAT_${chat_id}`, addMessage[0]);

        return {
          message: "Message sent successfully",
          status: 201,
          success: true,
        };

        // const chatData = await
      } catch (error) {
        console.log(error);
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    editMessage: async (
      _,
      { input: { message_ids, chat_ids, content } },
      ctx,
    ) => {
      const payload = ctx.user;

      // console.log(message_ids, "ctx dataaaaaaaa");
      if (message_ids.length < 1 || !content) {
        return {
          message: "Data is missing",
          success: false,
          status: 400,
        };
      }

      const message_id = message_ids[0];
      try {
        const messageData = await prisma.$queryRaw`
        
        select id,content,sender_id from message where id = ${message_id} and is_deleted = false limit 1
        
        `;

        // console.log(messageData, "message dataaa.");

        if (messageData.length < 1) {
          throw new Error("This message does not exist or has been deleted");
        }

        if (messageData[0].sender_id !== payload.userId) {
          throw new Error("You can only edit your message!");
        }

        const [editMessage, updateMessage] = await Promise.all([
          prisma.$queryRaw`

          insert into edit_message (message_id ,content ,old_content) values(${message_id},${content},${messageData[0].content})

          `,
          prisma.$queryRaw`

UPDATE message
SET 
    content = ${content},
    is_edited = true
WHERE id = ${message_id}

`,
        ]);

        if (!editMessage || !updateMessage) {
          throw new Error("Error in Updating");
        }

        return {
          message: "Message Edited successfully",
          status: 201,
          success: true,
        };
      } catch (err) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    deleteMessage: async (_, { input: { message_ids, delete_type } }, ctx) => {
      const payload = ctx.user;

      if (!message_ids.length > 0 || !delete_type) {
        return {
          message: "Data is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);
        // const memeberdata = await checkMemeberExists(
        //   prisma,
        //   messageData[0].chat_id,
        //   payload.userId,
        // );
        // if (messageData.length < 1) {
        //   throw new Error(
        //     "This Message doest not Exists or  is Already deleted",
        //   );
        // }

        console.log(messageData, "message dataaaa..._..");

        if (delete_type === "onlyme") {
          const values = message_ids
            .map((id) => `(${id}, ${payload.userId})`)
            .join(",");

          const updated = await prisma.$executeRawUnsafe(`
          INSERT INTO message_delete_for_me
          (message_id, user_id)
          VALUES ${values}
        `);

          if (!updated) {
            throw new Error("Message Deletion Failed");
          }
        } else if (delete_type === "everyone") {
          const verify = messageData.map((m) => {
            if (m.sender_id != payload.userId) {
              throw new Error(
                "You can only delete  the messages which you have sent!",
              );
            }
          });

          const deleted = await prisma.$queryRaw`
        

        update message set is_deleted = true 
        where id = ANY(${message_ids}) and sender_id = ${payload.userId} ;

        `;

          console.log(deleted, "deleetddddd");

          if (!deleted) {
            throw new Error("Message not deleted..");
          }
        } else {
          throw new Error("Delete type is Invalid");
        }
        return {
          message: "Message Deleted successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error, "errorrrr");
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    replyMessage: async (
      _,
      { input: { message_ids, chat_ids, content, media } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (message_ids.length !== 1 || (!content && !media)) {
        return {
          message: "Data is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);

        // const memeberdata = await checkMemeberExists(
        //   prisma,
        //   messageData[0].chat_id,
        //   payload.userId,
        // );

        const message_id = message_ids[0];
        // if (messageData.length < 1) {
        //   throw new Error("Message not Found");
        // }

        const updated = await prisma.$queryRaw`
        insert into message (content,sender_id, reply_to_message_id ,chat_id) values(${content},${payload.userId},${message_id} , ${messageData[0].chat_id})
        
        `;

        if (!updated) {
          throw new Error("Message reply Failed");
        }

        return {
          message: "Message Replied successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    reactMessage: async (
      _,
      { input: { message_ids, chat_ids, reaction_id } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (!message_ids.length > 0 || !reaction_id) {
        return {
          message: "data is Missing",
          success: false,
          status: 400,
        };
      }

      const message_id = message_ids[0];

      try {
        const [messaseData, reactionData] = await Promise.all([
          checkMessageExists(prisma, message_ids),
          prisma.$queryRaw`
          
          select react_id from reaction where react_id = ${reaction_id}

          `,
        ]);

        if (messaseData.length < 1 || reactionData.length < 1) {
          throw new Error(
            "Message or Reaction doesnt exists or has been deleted",
          );
        }

        const updated = await prisma.$queryRaw`
        
        INSERT INTO message_reaction (
    message_id,
    reaction_id,
    user_id
)

VALUES (
   ${message_id},
   ${reaction_id},
   ${payload.userId}
)

ON CONFLICT (message_id, user_id)

DO UPDATE
SET 
    reaction_id = EXCLUDED.reaction_id,
    updated_at = CURRENT_TIMESTAMP;
        
        
        `;

        if (!updated) {
          throw new Error("Reaction Failed");
        }

        return {
          message: "Successfully Reacted Message",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Sonme thing went wrong",
          ststu: 500,
          success: false,
          error: error.message,
        };
      }
    },
    // very complex logic......
    forwardMessage: async (
      _,
      { input: { message_ids, chat_ids = [], reciever_ids = [] } },
      ctx,
    ) => {
      const payload = ctx.user;

      if (
        !message_ids?.length ||
        (!chat_ids?.length && !reciever_ids?.length)
      ) {
        return {
          message: "Data is missing",
          success: false,
          status: 400,
        };
      }

      try {
        // =========================
        // validate messages
        // =========================

        const messages = await checkMessageExists(prisma, message_ids);

        // =========================
        // validate users
        // =========================

        // if (reciever_ids.length > 0) {

        //   const usersData = await chekUserExists(
        //     prisma,
        //     reciever_ids
        //   );

        //   if (
        //     usersData.length !== reciever_ids.length
        //   ) {
        //     throw new Error(
        //       "Some users do not exist"
        //     );
        //   }
        // }

        // =========================
        // final chat ids
        // =========================

        const finalChatIds = [...chat_ids];

        // =========================
        // existing/new chats
        // =========================

        for (const recieverId of reciever_ids) {
          // existing private chat check

          const existingChat = await checkChatExists(prisma, payload.userId, [
            recieverId,
          ]);

          // =========================
          // existing chat
          // =========================

          if (existingChat.length > 0) {
            finalChatIds.push(existingChat[0].chat_id);
          } else {
            // =========================
            // create new private chat
            // =========================

            const newChat = await prisma.$queryRaw`

          INSERT INTO chat (
            chat_type
          )

          VALUES ('private')

          RETURNING id

        `;

            const newChatId = newChat[0].id;

            // =========================
            // add members
            // =========================

            await prisma.$queryRaw`

          INSERT INTO chat_member (
            member_id,
            chat_id
          )

          VALUES
          (
            ${payload.userId},
            ${newChatId}
          ),
          (
            ${parseInt(recieverId)},
            ${newChatId}
          )

        `;

            finalChatIds.push(newChatId);
          }
        }

        // =========================
        // remove duplicates
        // =========================

        const uniqueChatIds = [...new Set(finalChatIds)];

        // =========================
        // clone messages
        // =========================

        for (const message of messages) {
          // original message

          const originalMessage = await prisma.$queryRaw`

        SELECT
          content,
          sender_id,chat_id
        FROM message

        WHERE id = ${message.id}

      `;

          if (originalMessage.length < 1) {
            continue;
          }

          for (const chatId of uniqueChatIds) {
            // =========================
            // create forwarded message
            // =========================

            console.log(
              chatId,
              message.chat_id,
              message,
              originalMessage[0],
              "condiritooo",
            );
            const forwardedMessage = await prisma.$queryRaw`

          INSERT INTO message (
            content,
            sender_id,
            chat_id,
            is_forwarded,
            forwarded_from_message_id
          )

          VALUES (
            ${originalMessage[0].content},
            ${payload.userId},
            ${chatId},
           ${chatId !== message.chat_id ? true : false},
            ${message.id}
          )

          RETURNING id

        `;

            // =========================
            // copy attachments
            // =========================

            const attachments = await prisma.$queryRaw`

          SELECT
            url,
            file_type,
            file_name,
            file_size

          FROM attachment

          WHERE message_id = ${message.id}

        `;

            if (attachments.length > 0) {
              await Promise.all(
                attachments.map((file) => {
                  return prisma.$queryRaw`

                INSERT INTO attachment (
                  message_id,
                  url,
                  file_type,
                  file_name,
                  file_size
                )

                VALUES (
                  ${forwardedMessage[0].id},
                  ${file.url},
                  ${file.file_type},
                  ${file.file_name},
                  ${file.file_size}
                )

              `;
                }),
              );
            }
          }
        }

        return {
          message: "Successfully forwarded message",
          status: 201,
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
    seenMessage: async (_, { input: { message_ids, chat_ids } }, ctx) => {
      const payload = ctx.user;

      if (message_ids.length < 1) {
        return {
          message: "Message id is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const messageData = await checkMessageExists(prisma, message_ids);

        const seen = await prisma.seen_message.createMany({
          data: message_ids.map((m) => ({
            message_id: parseInt(m),
            user_id: payload.userId,
          })),
        });

        if (!seen) {
          throw new Error("Error in message seen");
        }
        return {
          message: "Successfully Seen message",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error, "error ");
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    setWallpaper: async (_, { url }, ctx) => {
      if (!url || url.length === 0) {
        return GraphQLError({
          message: "Data Missing",
          status: 400,
          success: false,
        });
      }

      try {
        const payload = ctx.user;

        const uploaded = await prisma.$queryRaw`
        
        INSERT INTO wallpapers (url, user_id)
VALUES (${url}, ${payload.userId})

ON CONFLICT (user_id)
DO UPDATE SET
    url = EXCLUDED.url,
    created_at = CURRENT_TIMESTAMP;
        
        `;

        if (!uploaded) {
          throw new Error("Upload Failed in Wallpaper");
        }

        return {
          message: "Successfully Uploaded Wallpaper",
          success: true,
          status: 201,
        };
      } catch (error) {
        return GraphQLError({
          message: error.message,
          status: 500,
          success: false,
        });
      }
    },
  },
};

export default chatResolver;

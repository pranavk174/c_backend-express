import prisma from "../../../prisma/prisma-client.js";
import { logger } from "../../utils/logger.js";

export const notificationResolver = {
  ResponseData: {
    __resolverType(obj) {
      logger.debug(obj, "object dataaaa notificationssssss");
      if (obj._responseType === "notifications") {
        return "notifications";
      }
      if (obj._responseType === "notification") {
        return "notification";
      }
      return null;
    },
  },
  Query: {
    getNotification: async (_, __, ctx) => {
      try {
        const payload = ctx.user;

        const res = await prisma.$queryRaw`
          
          
       SELECT 
      n.*,
      u.profile_pic,
      u.name
  FROM notification n
  
  INNER JOIN users u
  ON n.sender_id = u.id
  
  LEFT JOIN notification_seen ns
  ON ns.notification_id = n.notification_id
  AND ns.user_id = ${payload.userId}
  
  WHERE n.reciever_id = ${payload.userId}
  AND ns.notification_id IS NULL;
          
          `;

        // logger.debug(res, "resss from notificationssssss");

        if (res.length === 0) {
          return {
            message: "No Notification Found",
            status: 200,
            success: true,
            data: {
              _responseType: "notifications",
              items: [],
            },
          };
        }
        const notifications = res.reduce((acc, item) => {
          const data = {
            notification_id: item.notification_id,
            notification_type: item.notification_type,
            name: item.name,
            message: item.metadata.message,
            time: item.created_at,
            profile_pic: item.profile_pic,
            reference_id: item.reference_id,
          };

          acc.push(data);

          return acc;
        }, []);
        // logger.debug(notifications, "notofvtaiossss");

        return {
          message: "Suucessfull",
          status: 200,
          success: true,
          data: {
            _responseType: "notifications",
            items: notifications,
          },
        };
      } catch (error) {
        logger.debug(error);
        return {
          message: "errorrrr",
          status: 500,
          success: false,
        };
      }
    },
  },
  Mutation: {
    seenNotification: async (_, { input: { notification_ids = [] } }, ctx) => {
      const payload = ctx.user;

      try {
        if (notification_ids.length === 0) {
          return {
            success: false,
            status: 400,
            message: "Notification ids are required",
          };
        }

        const result = await prisma.$transaction(async (tx) => {
          // 1. Sirf current user ki notifications nikalo
          const notifications = await tx.notification.findMany({
            where: {
              notification_id: {
                in: notification_ids,
              },
              reciever_id: payload.id,
            },
            select: {
              notification_id: true,
            },
          });

          const validIds = notifications.map((n) => n.notification_id);

          if (validIds.length === 0) {
            return {
              updated: 0,
              ignored: notification_ids.length,
            };
          }

          // 2. Already seen notifications
          const alreadySeen = await tx.notificationSeen.findMany({
            where: {
              user_id: payload.id,
              notification_id: {
                in: validIds,
              },
            },
            select: {
              notification_id: true,
            },
          });

          const alreadySeenIds = alreadySeen.map((n) => n.notification_id);

          // 3. Sirf new notifications insert karo
          const newSeenIds = validIds.filter(
            (id) => !alreadySeenIds.includes(id),
          );

          if (newSeenIds.length > 0) {
            await tx.notificationSeen.createMany({
              data: newSeenIds.map((id) => ({
                user_id: payload.id,
                notification_id: id,
              })),
              skipDuplicates: true,
            });

            await tx.notification.updateMany({
              where: {
                notification_id: {
                  in: newSeenIds,
                },
              },
              data: {
                is_seen: true,
              },
            });
          }

          return {
            updated: newSeenIds.length,
            ignored: notification_ids.length - validIds.length,
            alreadySeen: alreadySeenIds.length,
          };
        });

        return {
          success: true,
          status: 200,
          message: "Notifications processed successfully.",
          ...result,
        };
      } catch (error) {
        return {
          success: false,
          status: 500,
          message: "Something went wrong",
          error: error.message,
        };
      }
    },
  },
  Resolver: {},
};

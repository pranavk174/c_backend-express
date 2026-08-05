/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";

import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";

export const seenNotificationMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { notification_ids = [] } }, ctx) => {
    const payload = ctx.user;

    logger.debug(notification_ids, "notifciation idssss", payload);

    if (notification_ids.length === 0) {
      throw new AppError({
        message: "Notification ids are required",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Sirf current user ki notifications nikalo
      // const notifications = await tx.notification.findMany({
      //   where: {
      //     notification_id: {
      //       in: notification_ids,
      //     },
      //     reciever_id: payload.id,
      //   },
      //   select: {
      //     notification_id: true,
      //   },
      // });

      const notifications = await tx.$queryRaw`
          

          select * from notification WHERE notification_id = ANY(${notification_ids}::int[]) and reciever_id = ${payload.userId} 

          `;

      const validIds = notifications.map((n) => n.notification_id);

      if (validIds.length === 0) {
        return {
          updated: 0,
          ignored: notification_ids.length,
        };
      }

      // 2. Already seen notifications
      // const alreadySeen = await tx.notificationSeen.findMany({
      //   where: {
      //     user_id: payload.id,
      //     notification_id: {
      //       in: validIds,
      //     },
      //   },
      //   select: {
      //     notification_id: true,
      //   },
      // });

      const alreadySeen = await tx.$queryRaw`
          
          select * from notification_seen where notification_id = ANY(${validIds}::int[])

          `;

      const alreadySeenIds = alreadySeen.map((n) => n.notification_id);

      // 3. Sirf new notifications insert karo
      const newSeenIds = validIds.filter((id) => !alreadySeenIds.includes(id));

      if (newSeenIds.length > 0) {
        const values = Prisma.join(
          newSeenIds.map((id) => Prisma.sql`(${payload.userId}, ${id})`),
        );

        await tx.$queryRaw`
  INSERT INTO notification_seen (user_id, notification_id)
  VALUES ${values}
  ON CONFLICT (user_id, notification_id) DO NOTHING;
`;

        await tx.$queryRaw`
  UPDATE notification
  SET is_seen = true
  WHERE notification_id = ANY(${newSeenIds}::int[])
`;
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
  },
);

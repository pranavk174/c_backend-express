import prisma from "../../../prisma/prisma-client.js";
import { Prisma } from "@prisma/client";

import { SEEN_NOTIFICATION } from "../../utils/events.js";
import { asyncSocketAPIHandeler } from "../../lib/util.js";

export const seenNotification =
  asyncSocketAPIHandeler(async (socket, payload, data, callback) => {

    const { notification_ids } = data;

    if (notification_ids.length === 0) {
      return callback({
        success: false,
        status: 400,
        message: "Notification ids are required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
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

    socket.emit(SEEN_NOTIFICATION, result);

    return callback({
      success: true,
      status: 200,
      message: "Notifications processed successfully.",
      ...result,
    });

  });

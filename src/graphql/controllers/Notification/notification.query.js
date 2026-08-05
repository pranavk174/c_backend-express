/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";

import { asyncGraphqlAPIHandeler } from "../../../lib/util.js";

export const getNotificationQUery = asyncGraphqlAPIHandeler(
  async (_, __, ctx) => {
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
  },
);

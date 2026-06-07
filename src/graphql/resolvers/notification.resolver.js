import prisma from "../../../prisma/prisma-client.js";

export const notificationResolver = {
  ResponseData: {
    __resolverType(obj) {
      console.log(obj, "object dataaaa notificationssssss");
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

        // console.log(res, "resss from notificationssssss");

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
        // console.log(notifications, "notofvtaiossss");

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
        console.log(error);
        return {
          message: "errorrrr",
          status: 500,
          success: false,
        };
      }
    },
  },
  Resolver: {},
};

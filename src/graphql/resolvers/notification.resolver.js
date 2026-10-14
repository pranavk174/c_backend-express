import { logger } from "../../utils/logger.js";

import { getNotificationQUery } from "../controllers/Notification/notification.query.js";
import { seenNotificationMutation } from "../controllers/Notification/notification.mutation.js";
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
    getNotification: getNotificationQUery,
  },
  Mutation: {
    seenNotification: seenNotificationMutation,
  },
  Resolver: {},
};

import prisma from "../../../prisma/prisma-client.js";
import { Prisma } from "@prisma/client";

export const seenNotification = async (socket, payload, data, callback) => {
  try {
    console.log(data, "data in notification seen event");

    const values = data.map((no) => Prisma.sql`(${no}, ${payload.userId})`);

    const seenData = await prisma.$queryRaw`
    
    
    insert into notification_seen (notification_id,user_id)  VALUES ${Prisma.join(values)}
    `;

    if (!seenData) {
      throw new Error("Error in Seeen Notifiation");
    }
    return callback({
      message: "Seen Successfully",
      status: 201,
      success: true,
    });
  } catch (error) {
    console.log(error, "error in seen notifctaion..");
    return callback({
      message: error.message,
      status: 500,
      success: false,
    });
  }
};

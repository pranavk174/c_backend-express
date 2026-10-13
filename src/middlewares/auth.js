import jwt from "jsonwebtoken";
import cookie from "cookie";
import { validateCookie } from "../lib/tokenvalidator.js";
import cors from "cors";
import prisma from "../../prisma/prisma-client.js";
import { allowedOrigins } from "../lib/helpers.js";
import { logger } from "../utils/logger.js";

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      req.user = null;
      return next();
    }

    // eslint-disable-next-line no-undef
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    // logger.debug(decoded, req.user, "req. user dataaaa.");

    next();
  } catch (error) {
    logger.debug(error, "errorrrrrr in middleware...");
    req.user = null;
    next();
  }
};

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");

    // logger.debug(cookies, "cookies data in auth middleware");
    const token = cookies.accessToken;
    // logger.debug(token, "token dataa..", cookies);

    const payload = await validateCookie(token);

    const profile_pic = await prisma.$queryRaw`
    
    select 
    
    name,
    case 
    when profile_pic is NULL then null else 
    profile_pic end as profile_pic
    
     from users where id = ${payload.userId}
    `;

    payload.profile_pic = profile_pic[0].profile_pic;
    payload.name = profile_pic[0].name;
    // logger.debug(payload , "middleware payloaddd")
    socket.user = payload;

    next();
  } catch (error) {
    // return {
    //   message: error.message,
    //   status: 401,
    //   success: false,
    // };
    next(new Error(error.message));
  }
};

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // mobile apps/postman/server-side requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
      // callback(null, true);
    }
  },

  credentials: true,
});

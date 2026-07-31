import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
// import { logger } from "@/utils/logger.js";
import { logger } from "../utils/logger.js";

export const errorHandler = (message, code, status, error) => {
  // logger.debug(error.code, "====== om errpr jandler");

  throw new GraphQLError(message, {
    extensions: {
      code,
      status,
      message,
      stack: error?.stack ? error?.stack : null,
    },
  });
};

export const validateToken = async (context) => {
  let payload;
  try {
    const cookie = await context.request.cookieStore?.get("accessToken");

    // logger.debug(cookie, "cookiessssss", context)
    // logger.debug(cookie, "cookies dataaaaa");
    if (!cookie) throw new Error("No Access token");

    const accessToken = cookie.value;
    payload = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch (err) {

    logger.debug(err.message, "errrrrrrrrr in validate token");

    // throw new Error(err.message || "Invalid Access token");
    return errorHandler(err.message, "Unauthenticated", 401, err);
  }

  return payload;
};

export const validateCookie = async (token) => {
  let payload;
  try {
    const cookie = token;
    if (!cookie) throw new Error("No Access token");

    const accessToken = token;
    payload = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch (err) {

    return errorHandler(err.message || "Invalid Access token", "UNAUTHORIZED", 401, err);


  }

  return payload;
};

export const generateTokens = (id, email, device_id) => {
  const accessToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1m",
    },
  );

  const refreshToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
    },
    process.env.REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
};

import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
import prisma from "../../prisma/prisma-client.js";
import { AppError } from "./errorHandler.js";
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
  const cookie = await context.request.cookieStore?.get("accessToken");
  if (!cookie)
    throw new AppError({
      message: "No Access Token",
      status: 401,
      code: "FORBIDDEN",
    });
  const accessToken = cookie.value;
  payload = jwt.verify(accessToken, process.env.JWT_SECRET);

  const exists =
    await prisma.$queryRaw`SELECT session_id FROM devices WHERE user_id = ${payload.userId} AND device_id = ${payload.device_id} AND session_id = ${payload.session_id}`;

  if (exists[0].session_id !== payload.session_id) {
    throw new AppError({
      message: "Invalid session Token is revoked Login Again",
      status: 401,
      code: "FORBIDDEN",
    });
  }

  return payload;
};

export const validateCookie = async (token) => {
  let payload;
  try {
    let cookie = token;
    if (typeof token !== "string") {
      cookie = token.value;
    }

    if (!cookie) throw new Error("No Access token");

    // const accessToken = token;
    // eslint-disable-next-line no-undef
    payload = jwt.verify(cookie, process.env.JWT_SECRET);

    const exists =
      await prisma.$queryRaw`SELECT session_id FROM devices WHERE user_id = ${payload.userId} AND device_id = ${payload.device_id} AND session_id = ${payload.session_id}`;

    if (exists[0].session_id !== payload.session_id) {
      throw new AppError({
        message: "Invalid session Token is revoked Login Again",
        status: 401,
        code: "FORBIDDEN",
      });
    }
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw new AppError({
        message: err.message,
        status: 401,
        code: "FORBIDDEN",
      });

    throw err;
  }

  return payload;
};

export const generateTokens = (id, email, device_id, values = {}) => {
  const accessToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
      ...values,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  console.log(values, "values data in generate token");

  const refreshToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
      ...values,
    },
    process.env.REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
};

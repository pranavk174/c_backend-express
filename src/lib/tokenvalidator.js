/* eslint-disable no-undef */
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
// import { logger } from "@/utils/logger.js";
// import { logger } from "../utils/logger.js";
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
      code: "FORBIDDEN"
    });
  const accessToken = cookie.value;
  payload = jwt.verify(accessToken, process.env.JWT_SECRET);
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
    if (err.name === "TokenExpiredError")
      throw new AppError({
        message: err.message,
        status: 401,
        code: "FORBIDDEN"
      })

    throw err
  }

  return payload;
};

export const generateTokens = (id, email, device_id, values = {},) => {

  const accessToken = jwt.sign(
    {
      userId: id,
      device_id,
      email,
      ...values,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1m",
    },
  );

  console.log(values, "values data in generate token")

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

/* eslint-disable no-undef */
import { ERROR } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { AppError } from "./errorHandler.js";
import bcrypt from "bcrypt";
import { RateLimiterMemory } from "rate-limiter-flexible";

export const isDev = process.env.NODE_ENV !== "production";
export const asyncGraphqlAPIHandeler =
  (resolver) => async (parent, input, context, info) => {
    try {
      const response = await resolver(parent, input, context, info);
      // logger.info(response, "response in dataa")
      return response;
    } catch (error) {
      logger.debug(error, "error classs nhi");
      logger.debug(error.cause, "errro .code");

      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === "PrismaClientKnownRequestError") {
        throw new AppError({
          message: error.message,
          status: 500,
          code: isDev ? error.code : "DB_ERROR",
          // detail: error.issues[0],
        });
      }
      if (error.name === "ReferenceError") {
        const message = isDev ? error.message : "Something went Wrong";
        const code = isDev ? "INTERNAL_ERROR" : "VARIABLE_ERROR";
        throw new AppError({
          message,
          status: 500,
          code,
          details: error.stack,
        });
      }
      if (error.name === "TypeError") {
        throw new AppError({
          message: error.message,
          status: 500,
          code: "USER_NOT_FOUND_ERROR",
        });
      }
      if (error.name === "ZodError") {
        logger.debug(error.issues[0].message, "error in zod ");
        throw new AppError({
          message: error.issues[0].message,
          status: 400,
          code: "INPUT_VALIDATION_ERROR",
          detail: error.issues[0],
        });
      }
      if (error.name === "TokenExpiredError") {
        throw new AppError({
          message: error.message,
          status: 401,
          code: "TOKEN_EXPIRED",
          cause: {
            error: error.message,
          },
          // detail: error.issues[0],
        });
      }

      if (error.consumedPoints >= 6) {
        logger.debug(error, "in get userssssssss", error.name);
        const retryAfter = Math.ceil(error.msBeforeNext / 1000 / 60);
        throw new AppError({
          message: `Too many requests. Try again after ${retryAfter} Minutes.`,
          code: error.code ?? "RATE_LIMIT_ERROR",
          status: 429,
          cause: {
            error: error.message,
          },
          detail: {
            retryAfter,
          },
        });
      }
      // throw error;
      if (error instanceof Error) {
        // logger.debug(error.cause, "errro .code in instance")
        throw new AppError({
          message: "Something Went Wrong",
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          cause: {
            error: error.message,
          },
        });
      }

      // return errorHandler(error.message, "INTERNAL_SERVER_ERROR", 500);
    }
  };

export const asyncHandeler = (method) => async (data) => {
  try {
    return await method(data);
  } catch (error) {
    logger.debug(error.message, "error in handler");
    throw error;

    // throw new AppError({
    //   message: error.message,
    //   status: 500,
    //   code: error.code,
    // });
  }
};

export const asyncSocketAPIHandeler =
  (method) => async (socket, payload, data, callback) => {
    try {
      return await method(socket, payload, data, callback);
    } catch (error) {
      logger.debug(error);
      socket.emit(ERROR, error.message);
      return callback({
        success: false,
        error: error.message,
        status: 500,
      });
    }
  };

export const otpGenrator = async () => {
  const SALT_ROUNDS = 10;
  const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  const otp = Math.floor(100000 + Math.random() * 900000);
  logger.debug(otp, "OTP");
  // generated OTP

  const hashedOtp = await bcrypt.hash(otp.toString(), SALT_ROUNDS);

  return { hashedOtp, otp, expires_at };
};

export const ApiLimiter = new RateLimiterMemory({
  points: 5, // Max 5 requests
  duration: 600, // 10 minutes
});

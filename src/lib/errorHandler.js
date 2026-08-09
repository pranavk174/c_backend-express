import { GraphQLError } from "graphql";
import { logger } from "../utils/logger.js";

export class AppError extends GraphQLError {
  constructor({
    message,
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    details = null,
    cause = null,
  }) {
    // logger.debug("data in error class", status, code, details);
    super(message, {
      extensions: {
        status,
        code,
        details,
        stack: cause?.stack ?? null,
      },
    });
  }
}

export class BadRequestError extends AppError {
  constructor(message, details, cause) {
    super({
      message,
      status: 400,
      code: "BAD_REQUEST",
      details,
      cause,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message, details, cause) {
    super({
      message,
      status: 404,
      code: "NOT_FOUND",
      details,
      cause,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message, details, cause) {
    super({
      message,
      status: 422,
      code: "VALIDATION_ERROR",
      details,
      cause,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message, details, cause) {
    super({
      message,
      status: 401,
      code: "UNAUTHORIZED",
      details,
      cause,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message, details, cause) {
    super({
      message,
      status: 403,
      code: "FORBIDDEN",
      details,
      cause,
    });
  }
}

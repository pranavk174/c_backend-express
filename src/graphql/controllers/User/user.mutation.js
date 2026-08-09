/* eslint-disable no-undef */
import prisma from "../../../../prisma/prisma-client.js";

import bcrypt from "bcrypt";

import { AppError, ForbiddenError } from "../../../lib/errorHandler.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../../../utils/nodemainler.js";
import { generateTokens } from "../../../lib/tokenvalidator.js";

import { logger } from "../../../utils/logger.js";
import {
  ApiLimiter,
  asyncGraphqlAPIHandeler,
  otpGenrator,
} from "../../../lib/util.js";
import { chekOTP } from "../../../lib/helpers.js";
import { inputValidate } from "../../../lib/schemavalidator.js";
export const sendOtpMutation = asyncGraphqlAPIHandeler(async (_, { email }) => {
  if (!email) {
    throw new AppError({
      message: "Email is Missing",
      status: 400,
      code: "DATA_MISSING_ERROR",
    });
  }

  inputValidate(email, "email");
  const limit = await ApiLimiter.consume(email);

  logger.debug(limit, "limit dataaaaa");
  const exists = await prisma.users.findFirst({
    where: { email },
  });

  const { hashedOtp, otp, expires_at } = await otpGenrator();
  logger.debug(otp, "OTP");

  if (exists) {
    if (
      exists.account_status === "deleted" ||
      exists.account_status === "suspended"
    ) {
      throw new AppError({
        message: `Account is ${exists.account_status}, contact support`,
        status: 403,
        code: "ACCOUNT_BLOCK_ERROR",
      });
    }

    // await sendMail(email, otp);

    await prisma.otp.upsert({
      where: { email },
      update: {
        otp: await bcrypt.hash(String(otp), 10),
        expires_at,
      },
      create: {
        email,
        otp: await bcrypt.hash(String(otp), 10),
        expires_at,
      },
    });

    return {
      message: `Otp Send Successfully ${otp} `,
      status: 200,
      success: true,
    };
  }

  const found = await prisma.register.findFirst({
    where: { email },
  });

  if (found) {
    await prisma.register.update({
      where: { email },
      data: {
        otp: hashedOtp,
        expires_at,
        is_verified: false,
      },
    });
  } else {
    await prisma.register.create({
      data: {
        email,
        otp: hashedOtp,
        expires_at,
      },
    });
  }

  return {
    message: `Otp Send Successfully ${otp}`,
    status: 201,
    success: true,
  };
});

export const verifyOtpMutation = asyncGraphqlAPIHandeler(
  async (
    _,
    { input: { email, otp, device_id, ip_address, location, device_name } },
    context,
  ) => {
    if (
      !email ||
      !otp ||
      !device_id ||
      !ip_address ||
      !location ||
      !device_name
    ) {
      throw new AppError({
        message: "data field is missing",
        status: 400,
        code: "DATA_MISSING_ERROR",
      });
    }

    await ApiLimiter.consume(email);

    const user = await prisma.users.findFirst({
      where: { email },
    });

    // logger.debug("error in verify");

    // if (user) throw new Error("error in uer");

    if (user) {
      if (
        user.account_status === "deleted" ||
        user.account_status === "suspended"
      ) {
        throw new AppError({
          message: `Account is ${user.account_status}, contact support`,
          status: 403,
          code: "ACCOUNT_BLOCK_ERROR",
        });
      }
      const record = await prisma.otp.findFirst({
        where: { email },
      });

      await chekOTP(otp, record);

      // cleanup
      await prisma.otp.delete({ where: { email } });

      const { accessToken, refreshToken } = generateTokens(
        user.id,
        email,
        device_id,
        {
          name: user.name,
          profile_pic: user.profile_pic,
        },
      );

      await prisma.$queryRaw`
  INSERT INTO devices (
    user_id,
    device_id,
    ip_address,
    location,
    device_name,
    last_login,
    created_at,
    refresh_token,
    expires_at
  )
  VALUES (
    ${user.id},
    ${device_id},
    ${ip_address},
    ${location},
    ${device_name},
    NOW(),
    NOW(),
    ${refreshToken},
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    ip_address = EXCLUDED.ip_address,
    location = EXCLUDED.location,
    refresh_token = EXCLUDED.refresh_token,
    last_login = NOW(),
    expires_at = NOW() + INTERVAL '7 days'
  RETURNING *;
`;
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      };

      context.res.cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000, // 15 min in ms
      });

      context.res.cookie("refreshToken", refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      });

      context.res.cookie("theme", user.theme, {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        path: "/",
      });
      return {
        message: "Login Successful",
        status: 200,
        success: true,
        data: {
          _responseType: "User",
          ...user,
        },
      };
    }

    // =========================
    // ✅ NEW USER REGISTER
    // =========================
    const record = await prisma.register.findFirst({
      where: { email },
    });

    await chekOTP(otp, record);

    const is_verified = await prisma.register.update({
      where: { email },
      data: {
        is_verified: true,
      },
    });

    return {
      message: "OTP Verified Successfully",
      status: 200,
      success: true,
      data: {
        _responseType: "verifyOtpData",
        ...{ email, is_verified: is_verified.is_verified },
      },
    };
  },
);

export const createUserMutation = asyncGraphqlAPIHandeler(
  async (
    _,
    {
      input: {
        fname,
        lname,
        user_name,
        email,
        mobile,
        bio = "Hey! There I am using chat App",
        profile_pic = "",
        cover_pic = null,
      },
    },
  ) => {
    if (!fname || !lname || !email || !mobile || !user_name) {
      throw new AppError({
        message: "Input data is missing , please fill all those fields",
        status: 400,
        code: "NOT_FOUND_ERROR",
      });
    }

    const isFound = await prisma.users.findFirst({
      where: {
        OR: [{ email: email }, { mobile: mobile }, { user_name: user_name }],
      },
    });

    if (isFound) {
      throw new AppError({
        message:
          "User Already exists with these data , try with different email or mobile or user name",
        status: 400,
        code: "EXISTS_ERROR",
      });
    }

    const isExists = await prisma.register.findFirst({
      where: {
        email,
      },
    });

    // if (!isExists) {
    //   throw new AppError({
    //     message: "User is not Registered ,Register please",
    //     status: 402,
    //     code: "REGISTER_ERROR",
    //   });
    // }

    if (!isExists || !isExists.is_verified) {
      const { hashedOtp, otp, expires_at } = await otpGenrator();

      await prisma.register.update({
        where: {
          email,
        },
        data: {
          otp: hashedOtp.toString(),
          expires_at,
        },
      });

      await sendMail(email, otp);

      throw new AppError({
        message: "User is not verified , Please Verify Otp Sent Successfully",
        status: 402,
        code: "REGISTER_ERROR",
      });
    }

    await Promise.all([
      prisma.users.create({
        data: {
          name: fname + " " + lname,
          email,
          mobile,
          user_name,
          bio,
          profile_pic,
          cover_pic,
        },
      }),
      prisma.register.delete({
        where: {
          email,
        },
      }),
    ]);

    return {
      message: "User Successfully created",
      status: 201,
      success: true,
    };
  },
);
export const updateUserMutation = asyncGraphqlAPIHandeler(
  async (_, { input }, context) => {
    const updateData = {};

    for (const key in input) {
      if (input[key] !== undefined) {
        updateData[key] = input[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return {
        message: "Input field is missing",
        status: 400,
        success: false,
      };
    }

    const payload = context.user;
    await prisma.users.update({
      where: {
        id: payload.userId,
      },
      data: updateData,
    });

    return {
      message: "User Updated Successfully",
      status: 201,
      success: true,
    };
  },
);

export const updatePreferenceMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { theme } }, ctx) => {
    const payload = ctx.user;

    const updated = await prisma.$queryRaw`
  
  update  users set theme = ${theme} where id = ${payload.userId} returning *
  
  
  `;

    await ctx.res.cookie("theme", updated[0].theme, {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return {
      message: "Preference Updated Successfully",
      status: 201,
      success: true,
    };
  },
);

export const deleteAccountMutation = asyncGraphqlAPIHandeler(
  async (_, { action_type }, context) => {
    const payload = context.user;
    const enums = ["deleted", "suspended"];
    if (!enums.includes(action_type.toLowerCase())) {
      throw new AppError({
        message: `Invalid action type`,
        status: 400,
        code: "INVALID_ACTION_ERROR",
      });
    }

    const exists = await prisma.users.findFirst({
      where: {
        id: payload.userId,
      },
    });

    if (!exists) {
      throw new AppError({
        message: "User Not Found",
        status: 404,
        code: "NOT_FOUND_ERROR",
      });
    }

    if (
      enums.includes(action_type.toLowerCase()) &&
      enums.includes(exists.account_status.toLowerCase())
    ) {
      throw new AppError({
        message: `Your account is already ${exists.account_status}ed.`,
        status: 403,
        code: "FORBIDDEN",
      });
    }

    await Promise.all([
      prisma.users.update({
        where: {
          id: payload.userId,
          OR: [
            { account_status: "active" },
            {
              account_status: "suspended",
            },
          ],
        },
        data: {
          account_status:
            action_type.toLowerCase() === "delete" ? "deleted" : "suspended",
          account_status_changed_at: new Date(),
        },
      }),
      prisma.devices.updateMany({
        where: {
          user_id: payload.userId,
        },
        data: {
          refresh_token: null,
          logged_out_at: new Date(),
        },
      }),
    ]);

    context.res.clearCookie("accessToken", { path: "/" });
    context.res.clearCookie("refreshToken", { path: "/" });
    return {
      message: `User ${action_type === "delete" ? "Deleted" : "Suspended"} Successfully`,
      status: 200,
      success: true,
    };
  },
);

export const generateRefreshTokenMutation = asyncGraphqlAPIHandeler(
  async (_, __, context) => {
    const cookie = context.req.cookies?.refreshToken;
    const accessTokenOld = context.req.cookies?.accessToken;
    if (!cookie && !accessTokenOld)
      throw new ForbiddenError(`No refresh token or Access Token`);

    const refreshToken = cookie;


    const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const device = await prisma.devices.findFirst({
      where: {
        user_id: payload.userId,
        refresh_token: refreshToken,
      },
    });

    if (!device) {
      throw new ForbiddenError("Token is Invalid or Revoked");
    }

    const { accessToken: newAccessToken } = generateTokens(
      payload.userId,
      payload.email,
      payload.device_id,

      {
        ...payload,
      },
    );

    // 🔁 new access token generate

    await context.res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 15 * 24 * 60 * 1000, // 15 min in ms
    });

    return {
      message: "Token refreshed",
      success: true,
      status: 200,
    };
  },
);

export const logoutMutation = asyncGraphqlAPIHandeler(
  async (_, __, context) => {
    const payload = context.user;
    // logger.debug(payload, "payloadddddd");

    await prisma.devices.update({
      where: {
        user_id_device_id: {
          user_id: payload.userId,
          device_id: payload.device_id,
        },
      },
      data: {
        refresh_token: null,
        logged_out_at: new Date(),
      },
    });

    context.res.clearCookie("accessToken", { path: "/" });
    context.res.clearCookie("refreshToken", { path: "/" });
    context.res.clearCookie("theme", { path: "/" });
    return {
      message: "Logout successful",
      success: true,
      status: 200,
    };
  },
);

export const blockUserMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { blocked_user_id, reason } }, context) => {
    const payload = context.user;

    if (!reason || reason.trim() === "" || !blocked_user_id) {
      throw new AppError({
        message: "Data is missing",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const exists = await prisma.users.findFirst({
      where: {
        id: blocked_user_id,
      },
    });

    if (!exists) {
      throw new AppError({
        message: "User Not Found",
        status: 404,
        code: "NOT_FOUND_ERROR",
      });
    }

    const existing = await prisma.block.findFirst({
      where: {
        user_id: payload.userId,
        blocked_user_id,
        unblocked_at: null,
      },
    });

    if (existing?.blocked) {
      throw new AppError({
        message: "User already blocked",
        status: 400,
        code: "NOT_FOUND_ERROR",
      });
    }

    await prisma.block.create({
      data: {
        user_id: payload.userId,
        blocked_user_id,
        blocked: true,
        reason,
        blocked_at: new Date(),
      },
    });

    return {
      message: "User Blocked Successfully",
      status: 200,
      success: true,
    };
  },
);

export const unBlockUserMutation = asyncGraphqlAPIHandeler(
  async (_, { input: { blocked_user_id } }, context) => {
    const payload = context.user;

    if (!blocked_user_id) {
      throw new AppError({
        message: "Data is missing",
        status: 400,
        code: "BAD_REQUEST",
      });
    }

    const exists = await prisma.users.findFirst({
      where: {
        id: blocked_user_id,
      },
    });

    if (!exists) {
      throw new AppError({
        message: "User Not Found",
        status: 404,
        code: "NOT_FOUND_ERROR",
      });
    }

    await prisma.block.updateMany({
      where: {
        user_id: payload.userId,
        blocked_user_id,
        unblocked_at: null,
      },

      data: {
        blocked: false,
        unblocked_at: new Date(),
      },
    });

    return {
      message: "User Unblocked Successfully",
      status: 200,
      success: true,
    };
  },
);

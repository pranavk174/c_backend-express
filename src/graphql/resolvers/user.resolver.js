/* eslint-disable no-undef */
import prisma from "../../../prisma/prisma-client.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";
import { sendMail } from "../../utils/nodemainler.js";
import { errorHandler, generateTokens } from "../../lib/tokenvalidator.js";

import { logger } from "../../utils/logger.js";
import { asyncGraphqlAPIHandeler } from "../../lib/util.js";
const userResolvers = {
  ResponseData: {
    __resolveType(obj) {
      // logger.debug(obj, "object dataaa");

      if (obj._responseType === "verifyOtpData") {
        return "verifyOtpData";
      }

      if (obj._responseType === "User") {
        return "User";
      }
      if (obj._responseType === "Users") {
        return "Users";
      }

      return null;
    },
  },
  Query: {
    getUser: async (_, __, context) => {
      try {
        const payload = context.user;
        const data = await prisma.users.findFirst({
          where: {
            email: payload.email,
          },
        });

        if (!data) {
          throw new Error();
        }

        // logger.debug(data, "userssss");

        return {
          message: "successfully retrived",
          status: 200,
          data: {
            _responseType: "User",
            ...data,
          },
          success: true,
        };
      } catch (error) {
        logger.debug(error, "error in get user");
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    getUsers:
      async (_, __, ctx) => {
        try {
          const payload = ctx.user;

          const users = await prisma.$queryRaw`
        SELECT
        u.*,
        MAX(cm.chat_id) AS chat_id
    FROM users u
   LEFT JOIN chat_member cm
    ON u.id = cm.member_id
    AND cm.chat_id IN (
        SELECT cm2.chat_id
        FROM chat_member cm2
        LEFT JOIN chat c
            ON c.id = cm2.chat_id
        WHERE cm2.member_id = ${payload.userId}
          AND c.chat_type = 'private'
    )
    
    WHERE u.id <> ${payload.userId}
    GROUP BY u.id;
      
        
        `;

          return {
            message: "Successfully retrieved Users",
            status: 200,
            success: true,
            data: {
              _responseType: "Users",
              items: users,
            },
          };

          // logger.debug(users, "users dataaaaaa.");
        } catch (error) {
          logger.debug(error, "in get userssssssss");
          errorHandler(error.message, "INTERNAL_SERVER_ERROR", 500);
        }
      },
  },
  Mutation: {
    sendOtpMail: asyncGraphqlAPIHandeler(async (_, { email }) => {
      if (!email) {
        return {
          message: "Email is Missing",
          status: 400,
          success: false,
        };
      }


      const exists = await prisma.users.findFirst({
        where: { email },
      });

      const otp = Math.floor(100000 + Math.random() * 900000);
      const expires_at = new Date(Date.now() + 5 * 60 * 1000);
      logger.debug(otp, "OTP");

      if (exists) {
        if (
          exists.account_status === "deleted" ||
          exists.account_status === "suspended"
        ) {
          return {
            message: `Account is ${exists.account_status}, contact support`,
            status: 403,
            success: false,
          };
        }

        // const sent = await sendMail(email, otp);
        // if (!sent) throw new Error();

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
          message: "Otp Send Successfully",
          status: 200,
          success: true,
        };
      }

      // const sent = await sendMail(email, otp);
      // if (!sent) throw new Error();

      // ✅ NEW USER → use register table
      const hashedOtp = await bcrypt.hash(String(otp), 10);

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

    }),
    verifyOtp: asyncGraphqlAPIHandeler(async (
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
        return {
          message: "data field is missing",
          status: 400,
          success: false,
        };
      }


      const user = await prisma.users.findFirst({
        where: { email },
      });

      // if (user) throw new Error("error in uer");

      if (user) {
        if (
          user.account_status === "deleted" ||
          user.account_status === "suspended"
        ) {
          return {
            message: `Account is ${user.account_status}, contact support`,
            status: 403,
            success: false,
          };
        }
        const record = await prisma.otp.findFirst({
          where: { email },
        });

        if (!record) {
          return { message: "OTP not found", status: 400, success: false };
        }
        const isMatch = await bcrypt.compare(String(otp), record.otp);
        if (!isMatch) {
          return { message: "Invalid OTP", status: 400, success: false };
          // throw new Error("Invalid Otp");
        }

        const isExpired = new Date(record.expires_at) < new Date();
        if (isExpired) {
          return { message: "Expired OTP", status: 400, success: false };
        }

        // logger.debug(
        //   record.otp,
        //   "record.otp1",
        //   otp,
        //   "otp1",
        //   record,
        //   email,
        //   user,
        // );

        // cleanup
        await prisma.otp.delete({ where: { email } });

        const { accessToken, refreshToken } = generateTokens(
          user.id,
          email,
          device_id,
        );
        logger.debug({
          user,
        });

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

      if (!record) {
        return { message: "OTP not found", status: 400, success: false };
      }
      const isMatch = await bcrypt.compare(String(otp), record.otp);
      if (!isMatch) {
        return { message: "Invalid OTP", status: 400, success: false };
        // throw new Error("Invalid Otp");
      }

      const isExpired = new Date(record.expires_at) < new Date();
      if (isExpired) {
        return { message: "Expired OTP", status: 400, success: false };
      }

      // create user
      // const newUser = await prisma.users.create({
      //   data: { email },
      // });

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

    })
    ,
    createUser: asyncGraphqlAPIHandeler(async (
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
        return {
          message: "Input data is missing , please fill all those fields",
          status: 400,
          success: false,
        };
      }

      const isFound = await prisma.users.findFirst({
        where: {
          OR: [
            { email: email },
            { mobile: mobile },
            { user_name: user_name },
          ],
        },
      });

      if (isFound) {
        return {
          message:
            "User Already exists with these data , try with different email or mobile or user name",
          status: 400,
          success: false,
        };
      }

      const isExists = await prisma.register.findFirst({
        where: {
          email,
        },
      });

      if (!isExists) {
        return {
          message: "User is not Registered ,Register please",
          status: 402,
          success: false,
        };
      }

      if (!isExists.is_verified) {
        const SALT_ROUNDS = 10;

        const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min
        const otp = Math.floor(100000 + Math.random() * 900000);
        logger.debug(otp, "OTP");
        // generated OTP

        const hashedOtp = await bcrypt.hash(otp.toString(), SALT_ROUNDS);
        await prisma.register.update({
          where: {
            email,
          },
          data: {
            otp: hashedOtp.toString(),
            expires_at,
          },
        });

        return {
          message:
            "User is not verified , Please Verify Otp Sent Successfully",
          status: 402,
          success: false,
        };
      }

      const [created, deleted] = await Promise.all([
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

    }),
    updateUser: asyncGraphqlAPIHandeler(async (_, { input }, context) => {
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

    })
    ,
    updatePreference: asyncGraphqlAPIHandeler(async (_, { input: { theme } }, ctx) => {
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

    })
    ,
    deleteUser: asyncGraphqlAPIHandeler(async (_, { action_type }, context) => {

      const payload = context.user;

      const exists = await prisma.users.findFirst({
        where: {
          id: payload.userId,
        },
      });

      if (!exists) {
        return {
          message: "User not found",
          status: 404,
          success: false,
        };
      }

      const enums = ["delete", "suspend"];
      if (
        (action_type === "delete" && exists.account_status === "deleted") ||
        (action_type === "suspend" && exists.account_status === "suspended")
      ) {
        return {
          message: `Your account is already ${exists.account_status}ed.`,
          status: 403,
          success: false,
        };
      }

      if (!enums.includes(action_type.toLowerCase())) {
        return {
          message: `Invalid action type`,
          status: 400,
          success: false,
        };
      }

      const [deleted, loggedout] = await Promise.all([
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
              action_type.toLowerCase() === "delete"
                ? "deleted"
                : "suspended",
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

    }),
    generateRefreshToken: asyncGraphqlAPIHandeler(async (_, __, context) => {

      const cookie = context.req.cookies?.refreshToken;
      if (!cookie) throw new Error("No refresh token");

      const refreshToken = cookie;
      logger.debug(refreshToken);
      let payload;

      try {
        payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
      } catch (err) {
        logger.debug(err, "error in token....");
        throw new Error("Invalid refresh token============");
      }

      const device = await prisma.devices.findFirst({
        where: {
          user_id: payload.userId,
          refresh_token: refreshToken,
        },
      });

      if (!device) {
        return {
          message: "Token is Invalid or Revoked",
          status: 400,
          success: false,
        };
      }

      const { accessToken: newAccessToken } = generateTokens(
        payload.userId,
        payload.email,
        payload.device_id,
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
    })
    ,
    logout: asyncGraphqlAPIHandeler(async (_, __, context) => {

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
    })
    ,
    blockUser: asyncGraphqlAPIHandeler(async (_, { input: { blocked_user_id, reason } }, context) => {
      const payload = context.user;

      if (!reason || reason.trim() === "" || !blocked_user_id) {
        return {
          message: "Data is missing",
          status: 400,
          success: false,
        };
      }

      const exists = await prisma.users.findFirst({
        where: {
          id: blocked_user_id,
        },
      });

      if (!exists) {
        return {
          message: "User not found",
          status: 404,
          success: false,
        };
      }

      const existing = await prisma.block.findFirst({
        where: {
          user_id: payload.userId,
          blocked_user_id,
          unblocked_at: null,
        },
      });

      if (existing?.blocked) {
        return {
          message: "User already blocked",
          status: 200,
          success: true,
        };
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

    }),
    unBlockUser: asyncGraphqlAPIHandeler(async (_, { input: { blocked_user_id } }, context) => {
      const payload = context.user;

      if (!blocked_user_id) {
        return {
          message: "User ID is missing",
          status: 400,
          success: false,
        };
      }

      const exists = await prisma.users.findFirst({
        where: {
          id: blocked_user_id,
        },
      });

      if (!exists) {
        return {
          message: "User not found",
          status: 404,
          success: false,
        };
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

    })
  },
};

export default userResolvers;

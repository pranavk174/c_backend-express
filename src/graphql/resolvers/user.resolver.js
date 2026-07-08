import prisma from "../../../prisma/prisma-client.js";
import { sendMail } from "../../utils/nodemainler.js";
import bcrypt from "bcrypt";
import { validateToken } from "../../lib/tokenvalidator.js";
import { GraphQLError } from "graphql";
import jwt from "jsonwebtoken";
const userResolvers = {
  ResponseData: {
    __resolveType(obj) {
      // console.log(obj, "object dataaa");

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

        // console.log(data, "userssss");

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
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    getUsers: async (_, __, ctx) => {
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
            SELECT chat_id
            FROM chat_member
            WHERE member_id = ${payload.userId}
        )
    WHERE u.id <> ${payload.userId}
    GROUP BY u.id;
      
        
        `;

        console.log(users, "users dataaaa.");

        if (!users) {
          throw new Error();
        }
        return {
          message: "Sucesfully retrieved Users",
          status: 200,
          success: true,
          data: {
            _responseType: "Users",
            items: users,
          },
        };

        // console.log(users, "users dataaaaaa.");
      } catch (error) {
        return {
          message: "Something went Wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
  },
  Mutation: {
    sendOtpMail: async (_, { email }) => {
      if (!email) {
        return {
          message: "Email is Missing",
          status: 400,
          success: false,
        };
      }

      try {
        const exists = await prisma.users.findFirst({
          where: { email },
        });

        const otp = Math.floor(100000 + Math.random() * 900000);
        const expires_at = new Date(Date.now() + 5 * 60 * 1000);
        console.log(otp, "OTP");

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
          message: "Otp Send Successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "Something Went wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    verifyOtp: async (
      _,
      { input: { email, otp, device_id, ip_address, location, device_name } },
      context,
    ) => {
      const { response } = context;

      if (
        !email ||
        !otp ||
        !device_id ||
        !ip_address ||
        !location ||
        !device_name
      ) {
        throw new Error("Data is missing");
      }
      console.log(
        email,
        otp,
        device_id,
        ip_address,
        location,
        device_name,
        "device meta data...",
      );
      try {
        const user = await prisma.users.findFirst({
          where: { email },
        });

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

          const isExpired = new Date(record.expires_at) < new Date();
          if (isExpired) {
            throw new Error("Expired Otp");
          }

          // console.log(
          //   record.otp,
          //   "record.otp1",
          //   otp,
          //   "otp1",
          //   record,
          //   email,
          //   user,
          // );

          const isMatch = await bcrypt.compare(String(otp), record.otp);
          if (!isMatch) {
            // return { message: "Invalid OTP", status: 400, success: false };
            throw new Error("Invalid Otp");
          }

          // cleanup
          await prisma.otp.delete({ where: { email } });

          const accessToken = jwt.sign(
            { userId: user.id, device_id: device_id, email: email },
            process.env.JWT_SECRET,
            { expiresIn: "1m" },
          );

          const refreshToken = jwt.sign(
            { userId: user.id, device_id: device_id, email: email },

            process.env.REFRESH_SECRET,
            { expiresIn: "7d" },
          );

          // const refreshToken = "hwelfjhsjsdlkfjkdfjldsjlksfjkdsfjldsla";

          // const addToken = await prisma.devices.upsert({
          //   where: {
          //     user_id_device_id: {
          //       user_id: user.id,
          //       device_id,
          //     },
          //   },
          //   update: {
          //     ip_address,
          //     location,
          //     refresh_token: refreshToken,
          //     last_login: new Date(),
          //     expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          //   },

          //   create: {
          //     user_id: user.id,
          //     device_id,
          //     ip_address,
          //     location,
          //     device_name,
          //     last_login: new Date(),
          //     created_at: new Date(),
          //     refresh_token: refreshToken,
          //     expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          //   },
          // });

          console.log({
            user,
          });

          const addToken = await prisma.$queryRaw`
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

          await context.request.cookieStore?.set("accessToken", accessToken, {
            httpOnly: true,
            path: "/",
            maxAge: 900, // 15 min
          });

          await context.request.cookieStore?.set("refreshToken", refreshToken, {
            httpOnly: true,
            path: "/",
            maxAge: 604800, // 7 days
          });

          await context.request.cookieStore?.set({
            name: "theme",
            value: user.theme,
            path: "/",
            httpOnly: false,
            sameSite: "lax",
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
          // return { message: "Invalid OTP", status: 400, success: false };
          throw new Error("Registration Failed");
        }

        const isExpired = new Date(record.expires_at) < new Date();
        if (isExpired) {
          throw new Error("OTP Expired");
        }

        const isMatch = await bcrypt.compare(String(otp), record.otp);
        if (!isMatch) {
          throw new Error("Invalid Otp");
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

        console.log(is_verified, "is verifieddd");

        return {
          message: "OTP Verified Successfully",
          status: 200,
          success: true,
          data: {
            _responseType: "verifyOtpData",
            ...{ email, is_verified: is_verified.is_verified },
          },
        };
      } catch (error) {
        console.log(error);
        // throw error;

        throw new GraphQLError(error.message || "Something went wrong", {
          extensions: {
            code: "BAD_REQUEST",
            http: {
              status: 400,
            },
          },
        });
        // return {
        //   message: "Something went wrong",
        //   status: 500,
        //   success: false,
        //   error: error.message,
        // };
      }
    },
    createUser: async (
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
      try {
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
          console.log(otp, "OTP");
          // generated OTP

          const hashedOtp = await bcrypt.hash(otp.toString(), SALT_ROUNDS);
          const updated = await prisma.register.update({
            where: {
              email,
            },
            data: {
              otp: hashedOtp.toString(),
              expires_at,
            },
          });

          if (!updated) {
            throw new Error();
          }
          return {
            message:
              "User is not verified , Please Verify Otp Send Successfully",
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

        if (!created || !deleted) {
          throw new Error();
        }

        return {
          message: "User Successfully created",
          status: 201,
          success: true,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "Something went wrong",
          status: 400,
          success: false,
          error: error.message,
        };
      }
    },
    updateUser: async (_, { input }, context) => {
      const payload = context.user;
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

      try {
        const payload = context.user;
        const updated = await prisma.users.update({
          where: {
            id: payload.userId,
          },
          data: updateData,
        });
        if (!updated) {
          throw new Error();
        }

        return {
          message: "User Updated Successfully",
          status: 201,
          success: true,
        };
      } catch (error) {
        return {
          message: "Something Went Wrong",
          status: 500,
          success: false,
          error: error.message,
        };
      }
    },
    deleteUser: async (_, { action_type }, context) => {
      try {
        const payload = context.user;

        const exists = await prisma.users.findFirst({
          where: {
            id: payload.userId,
          },
        });

        if (!exists) {
          throw new Error("User not found");
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
          throw new Error("Invalid action type");
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

        if (!deleted || !loggedout) {
          throw new Error();
        }

        await context.request.cookieStore?.delete("accessToken", {
          path: "/",
        });
        await context.request.cookieStore?.delete("refreshToken", {
          path: "/",
        });
        return {
          message: `User ${action_type === "delete" ? "Deleted" : "Suspended"} Successfully`,
          status: 200,
          success: true,
        };

        // await context.request.cookieStore?.delete("accessToken", {
      } catch (err) {
        console.log(err.message, "errror");
        return {
          message: "Something Went Wrong",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    generateRefreshToken: async (_, __, context) => {
      try {
        const cookie = await context.request.cookieStore?.get("refreshToken");
        if (!cookie) throw new Error("No refresh token");

        const refreshToken = cookie.value;
        console.log(refreshToken);
        let payload;

        try {
          payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        } catch (err) {
          console.log(err, "error in token....");
          throw new Error("Invalid refresh token============");
        }

        const device = await prisma.devices.findFirst({
          where: {
            user_id: payload.userId,
            refresh_token: refreshToken,
          },
        });

        if (!device) throw new Error("Token revoked");

        // 🔁 new access token generate
        const newAccessToken = jwt.sign(
          {
            userId: payload.userId,
            device_id: payload.device_id,
            email: payload.email,
          },
          process.env.JWT_SECRET,
          { expiresIn: "15m" },
        );

        await context.request.cookieStore?.set("accessToken", newAccessToken, {
          httpOnly: true,
          path: "/",
          maxAge: 900,
        });

        return {
          message: "Token refreshed",
          success: true,
          status: 200,
        };
      } catch (error) {
        console.log(error, "error in  generated token...");
        await context.request.cookieStore?.delete("accessToken");
        await context.request.cookieStore?.delete("refreshToken");
        return {
          message: "Failed to refresh token",
          success: false,
          error: error.message,
          status: 401,
        };
      }
    },
    logout: async (_, __, context) => {
      try {
        const payload = context.user;
        // console.log(payload, "payloadddddd");

        const loggedout = await prisma.devices.update({
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

        if (loggedout) {
          await context.request.cookieStore?.delete("accessToken", {
            path: "/",
          });
          await context.request.cookieStore?.delete("refreshToken", {
            path: "/",
          });
          return {
            message: "Logout successful",
            success: true,
            status: 200,
          };
        }
      } catch (error) {
        console.log(error);
        return {
          message: "Failed to logout",
          success: false,
          error: error.message,
          status: 401,
        };
      }
    },
    blockUser: async (_, { input: { blocked_user_id, reason } }, context) => {
      const payload = context.user;

      if (!reason || reason.trim() === "" || !blocked_user_id) {
        return {
          message: "Data is missing",
          status: 400,
          success: false,
        };
      }
      try {
        const exists = await prisma.users.findFirst({
          where: {
            id: blocked_user_id,
          },
        });

        if (!exists) {
          throw new Error("User not found");
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

        const blocked = await prisma.block.create({
          data: {
            user_id: payload.userId,
            blocked_user_id,
            blocked: true,
            reason,
            blocked_at: new Date(),
          },
        });

        if (!blocked) {
          throw new Error("Failed to block user");
        }

        return {
          message: "User Blocked Successfully",
          status: 200,
          success: true,
        };
      } catch (err) {
        // console.error(err);
        return {
          message: "Failed to block user",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
    unBlockUser: async (_, { input: { blocked_user_id } }, context) => {
      const payload = context.user;

      if (!blocked_user_id) {
        return {
          message: "User ID is missing",
          status: 400,
          success: false,
        };
      }
      try {
        const exists = await prisma.users.findFirst({
          where: {
            id: blocked_user_id,
          },
        });

        if (!exists) {
          throw new Error("User not found");
        }

        const updated = await prisma.block.updateMany({
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

        if (!updated) {
          throw new Error("Failed to unblock user");
        }

        return {
          message: "User Unblocked Successfully",
          status: 200,
          success: true,
        };
      } catch (err) {
        // console.error(err);
        return {
          message: "Failed to unblock user",
          status: 500,
          success: false,
          error: err.message,
        };
      }
    },
  },
};

export default userResolvers;

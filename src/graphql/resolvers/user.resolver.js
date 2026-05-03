import prisma from "../../../prisma/prisma-client.js";
import { sendMail } from "../../utils/nodemainler.js";
import bcrypt from "bcrypt";

export const resolvers = {
  ResponseData: {
    __resolveType(obj) {
      if (obj.fname || obj.user_name || obj.mobile) return "User";
      return "data";
    },
  },
  Query: {
    getUser: async(_, __, context) => {
      try {
        // if (!context.user) {
        //   throw new Error("Unauthorized User");
        // }

        const data = await prisma.users.findFirst({
          where :{
            email: "cpranav972@gmail.com"
          }
        })

        if(!data){
          throw new Error()
        }


        return {
          message: "success fully retuireived",
          status: 200,
          data,
          success:true
        };
      } catch (error) {
        return {
          message: "Something went wrong",
          status: 500,
          success:false
        }
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
        const schemaResult = await prisma.$queryRawUnsafe(
          "SELECT current_schema()",
        );
        console.log(schemaResult, "result..");
        const exists = await prisma.users.findFirst({
          where: {
            email: email,
          },
        });
        if (exists) {
          return {
            message: "User Already Exists",
            status: 403,
          };
        }

        console.log(email, "wmIL...");
        const sent = await sendMail(email, otp);

        if (!sent) {
          throw new Error();
        }

        const SALT_ROUNDS = 10;

        const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min
        const otp = Math.floor(100000 + Math.random() * 900000);

        // generated OTP

        const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);

        const found = await prisma.register.findFirst({
          where: {
            email: email,
          },
        });

        if (found) {
          const updated = await prisma.register.update({
            where: {
              email,
            },
            data: {
              otp: String(hashedOtp),
              expires_at,
            },
          });

          if (!updated) {
            throw new Error();
          }
          return {
            message: "Otp Send Successfully",
            status: 201,
          };
        }

        const created = await prisma.register.create({
          data: {
            email,
            otp: String(otp),
            expires_at,
          },
        });
        if (!created) {
          throw new Error();
        }

        return {
          message: "Otp Send Successfully",
          status: 201,
        };

        // const update =
      } catch (error) {
        console.log(error, "errrorrr");
        return {
          message: "Something Went wrong",
          status: 500,
          error,
        };
      }
    },
    verifyOtp: async (_, { email, otp }) => {
      try {
        const isMatched = await prisma.register.findFirst({
          where: {
            email: email,
          },
        });

        if (!isMatched) {
          return {
            message: "This Email in Invalid",
            status: 400,
            success: false,
          };
        }

        const isMatch = await bcrypt.compare(otp, isMatched.otp);

        if (!isMatch) {
          return {
            message: "This OTP in Invalid",
            status: 400,
            success: false,
          };
        }

        const isVerified = isMatched.is_verified;

        const isExpired = isMatched.expires_at < Date.now();

        if (isExpired) {
          return {
            message: "This OTP is Expired",
            status: 400,
            success: false,
          };
        }

        if (isVerified) {
          return {
            message: "Otp Verified Successfully",
            status: 200,
            success: true,
          };
        }

        const update = await prisma.register.update({
          where: {
            email,
            otp,
          },
          data: {
            is_verified: true,
            otp: null,
          },
        });

        if (!update) {
          throw new Error();
        }
        return {
          message: "Otp Verified Successfully",
          status: 200,
          success: true,
        };
      } catch (error) {
        console.log(error, "error.");
        return {
          message: "Something went wrong",
          status: 500,
          success: false,
        };
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
          about = "Hey! There I am usibg chat App",
          profile_pic = "",
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

          // generated OTP

          const hashedOtp = bcrypt.hash(otp, SALT_ROUNDS);
          const updated = await prisma.register.update({
            where: {
              email,
            },
            data: {
              otp: String(hashedOtp),
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
              bio: about,
              profile_pic,
              is_verified: true,
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
          status: 400,
          success: false,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "Something went wrong",
          status: 400,
          success: false,
        };
      }
    },
  },
};

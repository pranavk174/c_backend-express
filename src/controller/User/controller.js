import prisma from "../../../prisma/prisma-client.js";
import { logger } from "../../utils/logger.js";
import { sendMail } from "../../utils/nodemainler.js";

export const sendOtpEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.json({
      message: "Email is Missing",
      status: 400,
    });
  }
  try {
    const schemaResult = await prisma.$queryRawUnsafe(
      "SELECT current_schema()",
    );
    logger.debug(schemaResult, "result..");
    const exists = await prisma.users.findFirst({
      where: {
        email: email,
      },
    });
    if (exists) {
      return res.json({
        message: "User Already Exists",
        status: 403,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    logger.debug(email, "wmIL...");
    const sent = await sendMail(email, otp);

    if (!sent) {
      throw new Error();
    }

    const found = await prisma.register.findUnique({
      where: {
        email: email,
      },
    });

    const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    if (found) {
      const updated = await prisma.register.update({
        where: {
          email,
        },
        data: {
          otp: String(otp),
          expires_at,
        },
      });

      if (!updated) {
        throw new Error();
      }
      return res.json({
        message: "Otp Send Successfully",
        status: 201,
      });
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

    return res.json({
      message: "Otp Send Successfully",
      status: 201,
    });

    // const update =
  } catch (error) {
    logger.debug(error, "errrorrr");
    return res.json({
      message: "Something Went wrong ",
      status: 500,
      error,
    });
  }
};

export const verifyOtp = async (req, res) => {
  const { otp, email } = req.body;
  logger.debug("started...");
  try {
    const isMatched = await prisma.register.findFirst({
      where: {
        email: email,
        otp: otp,
      },
    });

    if (!isMatched) {
      return res.json({
        message: "This Email in Invalid",
        status: 400,
        success: false,
      });
    }

    const isVerified = isMatched.is_verified;

    const isExpired = isMatched.expires_at > Date.now();

    if (isExpired) {
      return res.json({
        message: "This OTP is Expired",
        status: 400,
        success: false,
      });
    }

    if (isVerified) {
      return res.json({
        message: "Otp Verified Successfully",
        status: 200,
        success: true,
      });
    }

    const update = await prisma.register.update({
      where: {
        email,
        otp,
      },
      data: {
        is_verified: true,
      },
    });

    if (!update) {
      throw new Error();
    }
    return res.json({
      message: "Otp Verified Successfully",
      status: 200,
      success: true,
    });
  } catch (error) {
    logger.debug(error, "error.");
    return res.json({
      message: "Something went wrong",
      status: 500,
      success: false,
    });
  }
};

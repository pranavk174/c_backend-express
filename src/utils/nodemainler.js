import nodemailer from "nodemailer";

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Accept self-signed or invalid certificates
    rejectUnauthorized: false,
  },
});

export const sendMail = async (email, otp) => {
  try {
    console.log(
      { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      "credentialsss",
    );
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER, // sender address
      to: email, // list of recipients
      subject: "Hello", // subject line
      text: `Hello world?  ${otp}`, // plain text body
      html: `<b>Hello world?  ${otp}</b>`, // HTML body
    });

    if (info.messageId) {
      return true;
    }

    return false;
  } catch (err) {
    console.log(err, "error in send mail......");

    switch (err.code) {
      case "ECONNECTION":
      case "ETIMEDOUT":
        console.error("Network error - retry later:", err.message);

        break;
      case "EAUTH":
        console.error("Authentication failed:", err.message);
        break;
      case "EENVELOPE":
        console.error("Invalid recipients:", err.rejected);
        break;
      default:
        console.error("Send failed:", err.message);
    }

    return false;
  }
};

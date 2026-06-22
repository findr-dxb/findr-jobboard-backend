const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOtpEmail = async (email, name, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Findr <no-reply@findr.ae>",
      to: email,
      subject: `Verify your email on Findr 🔑`,
      text: `Hello ${name},

Your email verification code is: ${otp}

Please enter this 4-digit code on the signup page to activate your Findr account.

If you did not request this, please ignore this email.

Best regards,
The Findr Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #059669; text-align: center;">Verify Your Email Address</h2>
          <p>Hello ${name},</p>
          <p>Thank you for registering on Findr! Please use the following 4-digit verification code to activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; background-color: #f3f4f6; padding: 10px 25px; border-radius: 6px; border: 1px solid #d1d5db;">${otp}</span>
          </div>
          <p>This code will verify your email and complete your registration process.</p>
          <p>If you did not sign up for a Findr account, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">This is an automated email, please do not reply directly.</p>
        </div>
      `
    });

    if (error) throw error;

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("OTP email sending failed:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOtpEmail };

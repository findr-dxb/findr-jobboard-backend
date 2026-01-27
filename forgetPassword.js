const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async (email, resetToken, name = "User") => {
    try {
        const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login/reset-password?token=${resetToken}`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: "Password Reset Request - Findr",
            text: `Hello ${name},

Reset your password using the link below:
${resetUrl}

This link expires in 15 minutes.

– Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        console.error("Password reset email error:", error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendPasswordResetEmail };

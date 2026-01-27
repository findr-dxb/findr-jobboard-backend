const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendWelcomeEmail = async (email, name, role) => {
    try {
        const welcomeMessage = role === "employer" 
            ? `Welcome to Findr! We're excited to help you find the perfect candidates for your team.`
            : `Welcome to Findr! We're excited to help you find your dream job.`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: `Welcome to Findr, ${name}! 🎉`,
            text: `Hello ${name},

${welcomeMessage}

Get started by completing your profile to unlock all features.

Best of luck on your journey!

– Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        console.error("Welcome email error:", error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendWelcomeEmail };

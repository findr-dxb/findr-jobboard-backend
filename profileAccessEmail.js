const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendProfileAccessEmail = async (email, accessLink, requesterName = "A user") => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Findr <no-reply@findr.ae>",
      to: email,
      subject: "View Profile Access - Findr",
      text: `Hello,

${requesterName} requested access to view your Findr profile.

Click the link below to approve this request. Once you approve, they will be able to view your profile.

${accessLink}

This link expires in 24 hours.

– Findr Team`,
    });

    if (error) throw error;
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("Profile access email error:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendProfileAccessEmail };

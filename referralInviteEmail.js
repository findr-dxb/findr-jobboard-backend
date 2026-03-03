const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a referral confirmation email to the referred person.
 * The email contains a magic link they must click to approve the job application.
 */
const sendReferralInviteEmail = async ({
  toEmail,
  toName,
  referrerName,
  jobTitle,
  companyName,
  approveUrl,
}) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Findr <no-reply@findr.ae>",
      to: toEmail,
      subject: `${referrerName} referred you for "${jobTitle}" at ${companyName}`,
      text: `Hello,

${referrerName} has referred you for a job on Findr.

Job: ${jobTitle}
Company: ${companyName}

To review this referral and approve your application, click the link below:

${approveUrl}

Your application will only be created after you approve this referral.
This link expires in 7 days.

– Findr Team`,
    });

    if (error) throw error;
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[sendReferralInviteEmail] Error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendReferralInviteEmail };

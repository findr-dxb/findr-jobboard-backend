const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendApplicationStatusUpdateEmail = async (email, applicantName, jobTitle, companyName, status, interviewInfo = null) => {
    try {
        const applicationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/jobseeker/applications`;

        let statusMessage = '';
        let subject = '';

        switch (status) {
            case 'shortlisted':
                subject = `Application Shortlisted - ${jobTitle} at ${companyName}`;
                statusMessage = `Great news! Your application for "${jobTitle}" at ${companyName} has been shortlisted.`;
                break;
            case 'interview_scheduled':
                subject = `Interview Scheduled - ${jobTitle} at ${companyName}`;
                const interviewDate = interviewInfo?.date ? new Date(interviewInfo.date).toLocaleDateString() : 'TBD';
                const interviewMode = interviewInfo?.mode === 'virtual' ? 'Virtual' : 'In-person';
                statusMessage = `Your interview for "${jobTitle}" at ${companyName} has been scheduled.\n\nInterview Date: ${interviewDate}\nMode: ${interviewMode}`;
                break;
            case 'hired':
                subject = `Congratulations! You've Been Hired - ${jobTitle} at ${companyName}`;
                statusMessage = `Congratulations! You have been selected for the position "${jobTitle}" at ${companyName}.`;
                break;
            case 'rejected':
                subject = `Application Update - ${jobTitle} at ${companyName}`;
                statusMessage = `Thank you for your interest. Unfortunately, your application for "${jobTitle}" at ${companyName} was not selected at this time.`;
                break;
            default:
                subject = `Application Status Updated - ${jobTitle} at ${companyName}`;
                statusMessage = `Your application status for "${jobTitle}" at ${companyName} has been updated to: ${status}.`;
        }

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: subject,
            text: `Hello ${applicantName},

${statusMessage}

View your applications:
${applicationUrl}

Thank you for using Findr!

– Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendApplicationStatusUpdateEmail };

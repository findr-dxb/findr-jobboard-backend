const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendApplicationConfirmationEmail = async (email, applicantName, jobTitle, companyName, appliedDate) => {
    try {
        const applicationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/jobseeker/applications`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: `Application Confirmed - ${jobTitle} at ${companyName}`,
            text: `Hello ${applicantName},

            Your application for "${jobTitle}" at ${companyName} has been successfully submitted!
            Application Date: ${new Date(appliedDate).toLocaleDateString()}
            View your applications:
            ${applicationUrl}
            The employer will review your application and contact you if you're shortlisted. Good luck!
            - Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const sendNewApplicationNotificationEmail = async (email, employerName, jobTitle, applicantName, appliedDate) => {
    try {
        const applicationsUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/employer/applications`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: `New Application Received - ${jobTitle}`,
            text: `Hello ${employerName},

            You have received a new application for "${jobTitle}".
            Applicant: ${applicantName}
            Application Date: ${new Date(appliedDate).toLocaleDateString()}
            View all applications:
            ${applicationsUrl}
            Review the candidate's profile and application to proceed with the next steps.
            – Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendApplicationConfirmationEmail, sendNewApplicationNotificationEmail };

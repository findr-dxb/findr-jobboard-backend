const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendJobPostedEmail = async (email, employerName, jobTitle, companyName, jobId) => {
    try {
        const jobUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/jobs/${jobId}`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: `Job Posted Successfully - ${jobTitle}`,
            text: `Hello ${employerName},

Your job posting "${jobTitle}" at ${companyName} has been successfully posted!

View your job posting:
${jobUrl}

Your job is now live and visible to job seekers. You'll receive notifications when candidates apply.

Good luck finding the perfect candidate!

– Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const sendJobNotificationEmail = async (email, jobSeekerName, jobTitle, companyName, location, jobType, jobId) => {
    try {
        const jobUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/jobs/${jobId}`;

        const { data, error } = await resend.emails.send({
            from: "Findr <no-reply@findr.ae>",
            to: email,
            subject: `New Job Opportunity - ${jobTitle} at ${companyName}`,
            text: `Hello ${jobSeekerName},

A new job opportunity has been posted that might interest you!

Job Title: ${jobTitle}
Company: ${companyName}
Location: ${location}
Job Type: ${jobType}

View job details:
${jobUrl}

Apply now and take the next step in your career!

– Findr Team`,
        });

        if (error) throw error;

        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendJobPostedEmail, sendJobNotificationEmail };

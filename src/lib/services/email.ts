import nodemailer from "nodemailer";

export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
}

export const sendEmail = async ({ to, subject, html, attachments }: EmailOptions) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const from = process.env.EMAIL_FROM || '"Opsy Admin" <noreply@theplahouse.com>';

    const info = await transporter.sendMail({
        from,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        html,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });

    console.log("Message sent: %s", info.messageId);
    return info;
};

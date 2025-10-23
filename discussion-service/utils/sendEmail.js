const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER, // Gmail
    pass: process.env.EMAIL_PASS  // app password
  }
});

const sendEmail = async ({ to, subject, text }) => {
  await transporter.sendMail({
    from: `"MetaStudy" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
};

module.exports = sendEmail;

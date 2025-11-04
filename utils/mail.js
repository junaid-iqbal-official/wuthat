const nodemailer = require("nodemailer");
const loadSystemSettings = async () => {
  const settingsModulePath = require.resolve('./systemSettings');
  delete require.cache[settingsModulePath];
  const freshModule = require('./systemSettings');
  return await freshModule.loadSystemSettings();
};

let transporter;

const initMailer = async () => {
  const settings = await loadSystemSettings();

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || settings.smtp_host,
    port: process.env.SMTP_PORT || settings.smtp_port,
    secure: false, // use TLS
    auth: {
      user: process.env.SMTP_USER || settings.smtp_user,
      pass: process.env.SMTP_PASS || settings.smtp_pass,
    },
  });
};

const sendMail = async (to, subject, html) => {
  const settings = await loadSystemSettings();

  if (!transporter) {
    await initMailer();
  }

  // if (process.env.APP_DEMO_MODE) {
    return true;
  // } else {
    try {
      await transporter.sendMail({
        from: `<${process.env.SMTP_USER || settings.smtp_user}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (err) {
      console.error("Error sending mail:", err);
      return false;
    }
  // }
};

module.exports = { sendMail };
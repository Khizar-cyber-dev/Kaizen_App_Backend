import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Prefer port 2525 on PaaS (often open), allow override via env
const smtpHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const smtpPort = Number(process.env.SMTP_PORT || 2525);
const isSecure = Boolean(process.env.SMTP_SECURE === "true"); // usually false for 2525/587

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: isSecure,
  requireTLS: !isSecure, // enforce STARTTLS when not using direct TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  // Timeout and pooling settings
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
  dnsTimeout: Number(process.env.SMTP_DNS_TIMEOUT || 15000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 60000),
  pool: true,
  maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 2),
  maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
  // Helpful in debugging non-prod
  logger: process.env.SMTP_DEBUG === "true" || process.env.NODE_ENV !== "production",
  debug: process.env.SMTP_DEBUG === "true" || process.env.NODE_ENV !== "production",
  // TLS options (be conservative; most providers require modern TLS)
  tls: {
    minVersion: "TLSv1.2",
    // leave rejectUnauthorized default (true) for production safety; allow override if needed
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === "false" ? false : true,
  },
});

// Avoid verify in production as it performs an actual network handshake at startup
if (process.env.NODE_ENV !== "production") {
  transporter.verify(function (error) {
    if (error) {
      console.log("SMTP connection error:", error);
    } else {
      console.log("SMTP server is ready to take our messages");
    }
  });
}

export default transporter;

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
  // Harden timeouts and enable pooling to reuse connections
  connectionTimeout: 10000, // 10s
  socketTimeout: 10000, // 10s
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  // Helpful in debugging non-prod
  logger: process.env.NODE_ENV !== "production",
  debug: process.env.NODE_ENV !== "production",
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
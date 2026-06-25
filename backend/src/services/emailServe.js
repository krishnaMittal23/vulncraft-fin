const nodemailer = require("nodemailer");
const axios = require("axios");

// Default sender. Resend's onboarding@resend.dev works with zero domain setup
// (delivers to the Resend account owner's verified address) — good for testing.
const FROM = () => process.env.EMAIL_FROM || "VulnCraft <onboarding@resend.dev>";

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
  }
  return _transporter;
}

/**
 * Send the security scan report. Prefers a transactional HTTP API (Resend) when
 * RESEND_API_KEY is set — no SMTP login / Gmail app password needed. Falls back
 * to SMTP (Gmail / SendGrid / Mailgun SMTP) when only EMAIL_USER/PASSWORD exist.
 * @returns {Promise<Object>} { sent, messageId?, error?, provider? }
 */
async function sendScanReport(options, scanData) {
  const { to, subject = "Security Scan Report" } = options;
  if (!to) return { sent: false, error: "Recipient email address required" };

  const html = generateReportHTML(scanData);

  // 1) Resend HTTP API (preferred)
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await axios.post(
        "https://api.resend.com/emails",
        { from: FROM(), to: [to], subject, html },
        {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          validateStatus: () => true,
        }
      );
      if (r.status >= 200 && r.status < 300) {
        console.log(`✅ Email sent via Resend: ${r.data?.id}`);
        return { sent: true, messageId: r.data?.id, recipient: to, provider: "resend" };
      }
      const msg = r.data?.message || r.data?.name || JSON.stringify(r.data);
      console.error("❌ Resend error:", r.status, msg);
      return { sent: false, error: `Resend ${r.status}: ${msg}` };
    } catch (error) {
      console.error("❌ Resend error:", error.message);
      return { sent: false, error: `Resend: ${error.message}` };
    }
  }

  // 2) SMTP fallback
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      const info = await getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"VulnCraft" <${process.env.EMAIL_USER}>`,
        to, subject, html,
      });
      console.log(`✅ Email sent via SMTP: ${info.messageId}`);
      return { sent: true, messageId: info.messageId, recipient: to, provider: "smtp" };
    } catch (error) {
      console.error("❌ Email error:", error.message);
      return { sent: false, error: error.message };
    }
  }

  console.warn("⚠️  Email not configured (set RESEND_API_KEY, or EMAIL_USER/EMAIL_PASSWORD)");
  return { sent: false, error: "Email service not configured (no RESEND_API_KEY or SMTP creds)" };
}

/**
 * Generate HTML report from scan data
 */
function generateReportHTML(scanData) {
  const toolNames = Object.keys(scanData);
  const date = new Date().toLocaleString();

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 10px 0 0;
          opacity: 0.9;
        }
        .section {
          background: #f7f9fc;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .section h2 {
          margin-top: 0;
          color: #667eea;
          text-transform: uppercase;
          font-size: 18px;
        }
        .finding {
          background: white;
          border: 1px solid #e1e8ed;
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .badge-high {
          background: #fee;
          color: #c00;
        }
        .badge-medium {
          background: #ffeaa7;
          color: #d63031;
        }
        .badge-low {
          background: #dfe6e9;
          color: #636e72;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e1e8ed;
          color: #95a5a6;
          font-size: 14px;
        }
        code {
          background: #f1f3f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔒 Security Scan Report</h1>
        <p>Automated vulnerability assessment completed on ${date}</p>
      </div>
  `;

  // Add sections for each tool
  toolNames.forEach(toolName => {
    const toolData = scanData[toolName];
    html += `
      <div class="section">
        <h2>${toolName.replace(/-/g, " ")}</h2>
    `;

    if (toolData.vulnerabilities && toolData.vulnerabilities.length > 0) {
      toolData.vulnerabilities.forEach(vuln => {
        const severity = vuln.severity || "low";
        html += `
          <div class="finding">
            <span class="badge badge-${severity.toLowerCase()}">${severity}</span>
            <strong>${vuln.title || vuln.name || "Vulnerability"}</strong>
            <p>${vuln.description || vuln.message || "No description available"}</p>
            ${vuln.url ? `<p><code>${vuln.url}</code></p>` : ""}
          </div>
        `;
      });
    } else if (toolData.total_findings) {
      html += `<p>✅ Found ${toolData.total_findings} items (see full report for details)</p>`;
    } else {
      html += `<p>✅ No critical vulnerabilities detected</p>`;
    }

    html += `</div>`;
  });

  html += `
      <div class="footer">
        <p>Generated by VulnCraft Security Platform</p>
        <p>This is an automated report. Please review findings carefully.</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  if (process.env.RESEND_API_KEY) {
    return { configured: true, message: "Email via Resend API", provider: "resend" };
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { configured: false, message: "No RESEND_API_KEY or SMTP credentials set" };
  }
  try {
    await getTransporter().verify();
    return { configured: true, message: "Email service is ready", provider: "smtp" };
  } catch (error) {
    return { configured: false, message: error.message };
  }
}

module.exports = {
  sendScanReport,
  verifyEmailConfig,
};
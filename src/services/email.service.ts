// ──────────────────────────────────────────────────────────────────────────────
// Email Service — Sends professional company brochure emails to leads
// Uses import nodemailer from 'nodemailer';
import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger';

const log = createLogger('EmailService');

class EmailService {
  private isConfigured = false;
  private transporter: nodemailer.Transporter | null = null;
  private get fromName(): string { return process.env['EMAIL_FROM_NAME'] || 'Aria | Your AI Assistant'; }
  // MUST be the exact email address you verified as a Sender in SendGrid
  private get fromEmail(): string { return process.env['EMAIL_USER'] || ''; }

  constructor() {
    this.configureClient();
  }

  private configureClient() {
    const user = process.env['EMAIL_USER'];
    const pass = process.env['EMAIL_PASS'];
    
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // use SSL
        auth: {
          user: user,
          pass: pass,
        },
      });
      this.isConfigured = true;
      log.info(`Nodemailer (Gmail SMTP) Email Service initialized`);
    } else {
      log.warn('Email Service disabled — EMAIL_USER or EMAIL_PASS not set in .env');
    }
  }

  /**
   * Detects an email address in a message string.
   */
  extractEmail(text: string): string | null {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : null;
  }

  /**
   * Sends the company brochure/services email to a lead.
   */
  async sendCompanyBrochure(toEmail: string, leadName: string): Promise<boolean> {
    // Attempt lazy config if env vars were loaded late
    if (!this.isConfigured) this.configureClient();

    if (!this.isConfigured || !this.transporter) {
      log.warn(`Cannot send email — EMAIL_USER/EMAIL_PASS not configured`);
      return false;
    }

    const htmlContent = this.buildBrochureHTML(leadName);

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: toEmail,
        subject: `Your Information Package from ${this.fromName} 📦`,
        html: htmlContent,
      });

      log.info(`✉️  Brochure email sent to ${toEmail} via Nodemailer (Gmail SMTP)`);
      return true;
    } catch (error: any) {
      log.error(`❌ Failed to send email to ${toEmail}:`, error);
      return false;
    }
  }

  /**
   * Builds a professional HTML email template.
   */
  private buildBrochureHTML(leadName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0f1115; font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1115; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#161b22; border-radius:16px; overflow:hidden; border:1px solid #30363d;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981,#3b82f6); padding:40px 40px 30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">🤖 Welcome to Our Agency</h1>
              <p style="margin:10px 0 0; color:rgba(255,255,255,0.9); font-size:16px;">AI-Powered Software Solutions</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:30px 40px 20px;">
              <p style="margin:0; color:#f0f6fc; font-size:18px; line-height:1.6;">
                Hi <strong>${leadName}</strong> 👋
              </p>
              <p style="margin:15px 0 0; color:#8b949e; font-size:15px; line-height:1.7;">
                Thank you for your interest! As promised, here's a complete overview of our services and how we can help your business grow with cutting-edge AI and automation.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none; border-top:1px solid #30363d; margin:10px 0;"></td></tr>

          <!-- Services Section -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="margin:0 0 20px; color:#10b981; font-size:20px;">💼 Our Services</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px; margin-bottom:12px;">
                    <h3 style="margin:0 0 8px; color:#60a5fa; font-size:16px;">🤖 AI Chatbots</h3>
                    <p style="margin:0; color:#8b949e; font-size:14px; line-height:1.5;">Custom WhatsApp, Telegram & web chatbots powered by cutting-edge AI models. Automate customer support, lead generation, and sales.</p>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px;">
                    <h3 style="margin:0 0 8px; color:#60a5fa; font-size:16px;">🌐 Web Applications</h3>
                    <p style="margin:0; color:#8b949e; font-size:14px; line-height:1.5;">Full-stack web apps with React, Node.js, and modern frameworks. From landing pages to complex SaaS platforms.</p>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px;">
                    <h3 style="margin:0 0 8px; color:#60a5fa; font-size:16px;">⚡ Automation Systems</h3>
                    <p style="margin:0; color:#8b949e; font-size:14px; line-height:1.5;">End-to-end business process automation — CRM integrations, email workflows, data pipelines, and intelligent scheduling.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none; border-top:1px solid #30363d; margin:10px 0;"></td></tr>

          <!-- Pricing Section -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="margin:0 0 20px; color:#10b981; font-size:20px;">💰 Our Packages</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Basic -->
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px; border-left:4px solid #60a5fa;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td><h3 style="margin:0; color:#f0f6fc; font-size:16px;">Basic</h3></td>
                        <td align="right"><span style="color:#60a5fa; font-size:22px; font-weight:700;">$499</span></td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <p style="margin:0; color:#8b949e; font-size:13px;">• Simple chatbot or landing page<br>• 1 revision round<br>• 2-week delivery</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <!-- Pro -->
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px; border-left:4px solid #34d399;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td><h3 style="margin:0; color:#f0f6fc; font-size:16px;">Pro ⭐</h3></td>
                        <td align="right"><span style="color:#34d399; font-size:22px; font-weight:700;">$999</span></td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <p style="margin:0; color:#8b949e; font-size:13px;">• AI chatbot + CRM dashboard<br>• 3 revision rounds<br>• Priority support<br>• 3-week delivery</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <!-- Enterprise -->
                <tr>
                  <td style="padding:15px; background-color:#21262d; border-radius:12px; border-left:4px solid #fbbf24;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td><h3 style="margin:0; color:#f0f6fc; font-size:16px;">Enterprise</h3></td>
                        <td align="right"><span style="color:#fbbf24; font-size:22px; font-weight:700;">Custom</span></td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <p style="margin:0; color:#8b949e; font-size:13px;">• Full-stack SaaS platform<br>• Unlimited revisions<br>• Dedicated project manager<br>• Custom timeline</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none; border-top:1px solid #30363d; margin:10px 0;"></td></tr>

          <!-- CTA Section -->
          <tr>
            <td style="padding:20px 40px 10px; text-align:center;">
              <h2 style="margin:0 0 10px; color:#f0f6fc; font-size:18px;">Ready to get started?</h2>
              <p style="margin:0 0 20px; color:#8b949e; font-size:14px;">Book a free 30-minute discovery call with our team!</p>
              <a href="${(process.env['CALENDLY_URL'] || 'https://calendly.com').includes('/app/') ? 'https://calendly.com' : (process.env['CALENDLY_URL'] || 'https://calendly.com')}" style="display:inline-block; background:linear-gradient(135deg,#10b981,#059669); color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">
                📞 Schedule Free Call
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px; text-align:center;">
              <p style="margin:0; color:#484f58; font-size:12px;">
                This email was sent by Aria, our AI assistant, because you expressed interest via WhatsApp.
              </p>
              <p style="margin:8px 0 0; color:#484f58; font-size:12px;">
                Working Hours: Mon–Fri, 9 AM – 5 PM EST
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

export const emailService = new EmailService();
export default emailService;

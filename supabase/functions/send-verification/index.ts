import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { getTwilioCredentials, getTwilioAuthHeader } from "../_shared/twilio.ts";

const logger = createLogger('send-verification');

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const supabaseAdmin = createServiceClient();

    const body = await parseJsonBody<{
      type: 'email' | 'phone';
      email?: string;
      phone?: string;
      userId?: string;
    }>(req, ['type']);

    const { type, email, phone, userId } = body;

    log.info('Request received', { type, email, phone: phone ? '***' + phone.slice(-4) : null });

    if (!['email', 'phone'].includes(type)) {
      return errorResponse('Invalid verification type. Must be "email" or "phone"', 400);
    }

    if (type === 'email' && !email) {
      return errorResponse('Email is required for email verification', 400);
    }

    if (type === 'phone' && !phone) {
      return errorResponse('Phone is required for phone verification', 400);
    }

    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

    // Store verification code
    const { error: insertError } = await supabaseAdmin
      .from('verification_codes')
      .insert({
        user_id: userId || null,
        email: type === 'email' ? email : null,
        phone: type === 'phone' ? phone : null,
        code,
        type,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      log.error('Error storing verification code', insertError);
      throw new Error('Failed to create verification code');
    }

    log.info('Verification code stored', { type, expiresAt: expiresAt.toISOString() });

    // Send the verification
    if (type === 'email') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

      if (!RESEND_API_KEY) {
        // For local development: log the code instead of sending email
        log.warn('EMAIL SERVICE NOT CONFIGURED - VERIFICATION CODE', { code, email });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📧 VERIFICATION CODE FOR ${email}: ${code}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return successResponse({
          success: true,
          message: 'Verification code generated (check console for code)',
          devMode: true,
          code // Include code in response for local dev
        });
      }

      const resend = new Resend(RESEND_API_KEY);

      const { error: emailError } = await resend.emails.send({
        from: 'AnswerAfter <onboarding@resend.dev>',
        to: [email!],
        subject: 'Verify your email - AnswerAfter',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 40px 20px; }
              .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .logo { text-align: center; margin-bottom: 24px; }
              .logo span { font-size: 24px; font-weight: bold; color: #18181b; }
              .logo .accent { color: #f97316; }
              h1 { color: #18181b; font-size: 24px; text-align: center; margin-bottom: 16px; }
              p { color: #71717a; font-size: 16px; line-height: 1.6; text-align: center; }
              .code { background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
              .code span { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; }
              .footer { text-align: center; color: #a1a1aa; font-size: 14px; margin-top: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <span>Answer<span class="accent">After</span></span>
              </div>
              <h1>Verify your email</h1>
              <p>Enter this code to verify your email address and complete your registration:</p>
              <div class="code">
                <span>${code}</span>
              </div>
              <p>This code expires in 10 minutes.</p>
              <div class="footer">
                <p>If you didn't request this code, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (emailError) {
        log.error('Error sending email', emailError as Error);
        throw new Error('Failed to send verification email');
      }

      log.info('Email sent successfully', { to: email });

    } else if (type === 'phone') {
      const twilioCredentials = getTwilioCredentials();
      const TWILIO_VERIFY_SERVICE_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

      if (!TWILIO_VERIFY_SERVICE_SID) {
        throw new Error('Twilio Verify Service not configured. Please add TWILIO_VERIFY_SERVICE_SID secret.');
      }

      // Use Twilio Verify API for proper SMS verification
      const verifyEndpoint = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;

      const formData = new URLSearchParams();
      formData.append('To', phone!);
      formData.append('Channel', 'sms');

      const smsResponse = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': getTwilioAuthHeader(twilioCredentials.accountSid, twilioCredentials.authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!smsResponse.ok) {
        const smsError = await smsResponse.text();
        log.error('Error sending SMS via Verify', new Error(smsError));
        throw new Error('Failed to send verification SMS');
      }

      log.info('SMS sent successfully via Twilio Verify', { to: '***' + phone!.slice(-4) });
    }

    return successResponse({
      success: true,
      message: `Verification ${type === 'email' ? 'email' : 'SMS'} sent successfully`
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});

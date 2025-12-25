import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-VERIFICATION] ${step}${detailsStr}`);
};

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { type, email, phone, userId } = body;

    logStep('Request received', { type, email, phone: phone ? '***' + phone.slice(-4) : null });

    if (!type || !['email', 'phone'].includes(type)) {
      throw new Error('Invalid verification type. Must be "email" or "phone"');
    }

    if (type === 'email' && !email) {
      throw new Error('Email is required for email verification');
    }

    if (type === 'phone' && !phone) {
      throw new Error('Phone is required for phone verification');
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
      logStep('Error storing verification code', { error: insertError });
      throw new Error('Failed to create verification code');
    }

    logStep('Verification code stored', { type, expiresAt: expiresAt.toISOString() });

    // Send the verification
    if (type === 'email') {
      if (!RESEND_API_KEY) {
        throw new Error('Email service not configured');
      }

      const resend = new Resend(RESEND_API_KEY);
      
      const { error: emailError } = await resend.emails.send({
        from: 'AnswerAfter <noreply@answerafter.com>',
        to: [email],
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
        logStep('Error sending email', { error: emailError });
        throw new Error('Failed to send verification email');
      }

      logStep('Email sent successfully', { to: email });

    } else if (type === 'phone') {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new Error('SMS service not configured');
      }

      // Use Twilio to send SMS
      const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append('To', phone);
      formData.append('From', '+18885551234'); // We'll use the master account messaging service
      formData.append('Body', `Your AnswerAfter verification code is: ${code}. It expires in 10 minutes.`);

      // Use Twilio Verify Service instead for better deliverability
      // For now, we'll use a simpler approach with messaging service
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      
      const smsResponse = await fetch(twilioEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!smsResponse.ok) {
        const smsError = await smsResponse.text();
        logStep('Error sending SMS', { error: smsError });
        throw new Error('Failed to send verification SMS');
      }

      logStep('SMS sent successfully', { to: '***' + phone.slice(-4) });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verification ${type === 'email' ? 'email' : 'SMS'} sent successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('verify-code');

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
      code: string;
      userId?: string;
    }>(req, ['type', 'code']);

    const { type, email, phone, code, userId } = body;

    log.info('Verification request', { type, email, phone: phone ? '***' + phone.slice(-4) : null });

    if (!['email', 'phone'].includes(type)) {
      return errorResponse('Invalid verification type', 400);
    }

    if (!code || code.length !== 6) {
      return errorResponse('Invalid verification code', 400);
    }

    // Build the query to find the verification code
    let query = supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('type', type)
      .eq('code', code)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (type === 'email' && email) {
      query = query.eq('email', email);
    } else if (type === 'phone' && phone) {
      query = query.eq('phone', phone);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: verificationCodes, error: fetchError } = await query;

    if (fetchError) {
      log.error('Error fetching verification code', fetchError);
      throw new Error('Failed to verify code');
    }

    if (!verificationCodes || verificationCodes.length === 0) {
      log.info('Invalid or expired code');
      return errorResponse('Invalid or expired verification code', 400);
    }

    const verification = verificationCodes[0];

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from('verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      log.error('Error updating verification', updateError);
      throw new Error('Failed to mark code as verified');
    }

    // If we have a userId, update their profile
    const targetUserId = userId || verification.user_id;
    if (targetUserId) {
      const updateData: { email_verified?: boolean; phone_verified?: boolean; phone?: string } = {};

      if (type === 'email') {
        updateData.email_verified = true;
      } else if (type === 'phone') {
        updateData.phone_verified = true;
        if (phone) {
          updateData.phone = phone;
        }
      }

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', targetUserId);

      if (profileError) {
        log.warn('Error updating profile', { error: profileError.message });
      } else {
        log.info('Profile updated', { userId: targetUserId, type });
      }
    }

    log.info('Verification successful', { type, verificationId: verification.id });

    return successResponse({
      success: true,
      message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully`,
      verified: true
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});

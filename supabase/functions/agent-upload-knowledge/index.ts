import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getUserFromAuth } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getElevenLabsApiKey, uploadKnowledgeBaseDocument } from "../_shared/elevenlabs.ts";

const logger = createLogger('agent-upload-knowledge');

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOCUMENTS = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    // Get user from request
    const supabase = createServiceClient();
    const authHeader = req.headers.get('authorization');
    const { user, error: authError } = await getUserFromAuth(authHeader);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get user's account_id from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.account_id) {
      return errorResponse('User not found or not associated with an account', 401);
    }

    const accountId = userData.account_id;
    log.info('Processing KB upload', { accountId });

    // Check subscription tier (Pro+ required)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!subscription?.plan) {
      return errorResponse('No active subscription', 403);
    }

    const { data: tierData } = await supabase
      .from('subscription_tiers')
      .select('has_custom_ai_training')
      .eq('plan_id', subscription.plan)
      .single();

    if (!tierData?.has_custom_ai_training) {
      return errorResponse('Knowledge base upload requires Pro plan or higher', 403);
    }

    // Check existing document count
    const { count: existingCount } = await supabase
      .from('knowledge_base_documents')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if ((existingCount || 0) >= MAX_DOCUMENTS) {
      return errorResponse(`Maximum of ${MAX_DOCUMENTS} documents allowed. Please delete an existing document first.`, 400);
    }

    // Parse multipart form data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Content-Type must be multipart/form-data', 400);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return errorResponse('Only PDF files are allowed', 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 400);
    }

    log.info('File validated', { fileName: file.name, size: file.size });

    // Get API key
    let apiKey: string;
    try {
      apiKey = getElevenLabsApiKey();
    } catch {
      return errorResponse('ElevenLabs API key not configured', 500);
    }

    // Upload to ElevenLabs
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const elevenLabsDoc = await uploadKnowledgeBaseDocument(fileBuffer, file.name, apiKey);

    log.info('Document uploaded to ElevenLabs', { documentId: elevenLabsDoc.id });

    // Save to database
    const { data: savedDoc, error: saveError } = await supabase
      .from('knowledge_base_documents')
      .insert({
        account_id: accountId,
        elevenlabs_document_id: elevenLabsDoc.id,
        name: file.name,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    if (saveError) {
      log.error('Error saving document to database', saveError);
      // Try to clean up the uploaded document
      try {
        const { deleteKnowledgeBaseDocument } = await import("../_shared/elevenlabs.ts");
        await deleteKnowledgeBaseDocument(elevenLabsDoc.id, apiKey);
      } catch (cleanupError) {
        log.error('Error cleaning up document after save failure', cleanupError as Error);
      }
      return errorResponse('Failed to save document reference', 500);
    }

    log.info('Document saved to database', { docId: savedDoc.id });

    // Trigger agent update to include new document
    try {
      const { data: session } = await supabase.auth.getSession();
      await supabase.functions.invoke('elevenlabs-agent', {
        body: {
          action: 'update-agent',
          accountId: accountId,
        },
        headers: session?.session?.access_token
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined,
      });
      log.info('Agent update triggered');
    } catch (updateError) {
      log.error('Error triggering agent update', updateError as Error);
      // Don't fail - document is saved, agent update can be retried
    }

    return successResponse({
      success: true,
      document: {
        id: savedDoc.id,
        elevenlabs_document_id: elevenLabsDoc.id,
        name: file.name,
        file_size_bytes: file.size,
      },
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});

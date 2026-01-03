import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getUserFromAuth } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getElevenLabsApiKey, deleteKnowledgeBaseDocument } from "../_shared/elevenlabs.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('agent-delete-knowledge');

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

    // Parse request body
    const body = await parseJsonBody<{ documentId: string }>(req, ['documentId']);
    const { documentId } = body;

    log.info('Processing KB delete', { accountId, documentId });

    // Get the document and verify ownership
    const { data: doc, error: fetchError } = await supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('id', documentId)
      .eq('account_id', accountId)
      .single();

    if (fetchError || !doc) {
      return errorResponse('Document not found', 404);
    }

    // Get API key
    let apiKey: string;
    try {
      apiKey = getElevenLabsApiKey();
    } catch {
      return errorResponse('ElevenLabs API key not configured', 500);
    }

    // Delete from ElevenLabs
    try {
      await deleteKnowledgeBaseDocument(doc.elevenlabs_document_id, apiKey);
      log.info('Document deleted from ElevenLabs', { elevenlabsDocId: doc.elevenlabs_document_id });
    } catch (elevenLabsError) {
      log.error('Error deleting from ElevenLabs', elevenLabsError as Error);
      // Continue to delete from database anyway - document may already be gone from ElevenLabs
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('knowledge_base_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      log.error('Error deleting from database', deleteError);
      return errorResponse('Failed to delete document', 500);
    }

    log.info('Document deleted from database', { docId: documentId });

    // Trigger agent update to remove document from knowledge base
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
      // Don't fail - document is deleted, agent update can be retried
    }

    return successResponse({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});

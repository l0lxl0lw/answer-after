/**
 * Error handling utilities
 * Provides standardized error responses and handling
 */

import { EdgeFunctionError } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create a standardized error response
 */
export function errorResponse(
  error: Error | EdgeFunctionError | string,
  statusCode: number = 500
): Response {
  if (error instanceof EdgeFunctionError) {
    return new Response(
      JSON.stringify(error.toJSON()),
      {
        status: error.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  return new Response(
    JSON.stringify({ error: errorMessage }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a success response
 */
export function successResponse(data: any, statusCode: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * CORS preflight response
 */
export function corsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Wrap an async handler with try-catch and error formatting
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method === 'OPTIONS') {
        return corsPreflightResponse();
      }

      return await handler(req);
    } catch (error) {
      console.error('Handler error:', error);
      return errorResponse(error as Error);
    }
  };
}

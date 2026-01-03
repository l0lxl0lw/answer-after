import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders, handleCors, handleError, successResponse } from "../_shared/responses.ts";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000;

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, keep it. Otherwise, assume US number
  if (!cleaned.startsWith('+')) {
    // Remove leading 1 if present and add +1
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      return null; // Invalid length
    }
  }

  // Validate length (E.164 is 8-15 digits plus +)
  if (cleaned.length < 9 || cleaned.length > 16) {
    return null;
  }

  return cleaned;
}

// Parse CSV content
function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  // Parse rows
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return handleError(new Error('Missing authorization header'), 401);
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user and account
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return handleError(new Error('Unauthorized'), 401);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.account_id) {
      return handleError(new Error('No account found'), 400);
    }

    const accountId = profile.account_id;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return handleError(new Error('No file provided'), 400);
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return handleError(new Error('Only CSV files are allowed'), 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return handleError(new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`), 400);
    }

    // Read file content
    const content = await file.text();
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return handleError(new Error('CSV file is empty'), 400);
    }

    if (rows.length > MAX_ROWS) {
      return handleError(new Error(`Too many rows. Maximum is ${MAX_ROWS}`), 400);
    }

    // Check required column
    const firstRow = rows[0];
    if (!('phone' in firstRow)) {
      return handleError(new Error('CSV must have a "phone" column'), 400);
    }

    // Process rows
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = normalizePhone(row.phone);

      if (!phone) {
        result.errors.push({
          row: i + 2, // +2 for header and 0-indexing
          phone: row.phone,
          error: 'Invalid phone number format',
        });
        continue;
      }

      // Check for existing contact
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .eq('phone', phone)
        .maybeSingle();

      if (existing) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            name: row.name || undefined,
            email: row.email || undefined,
            address: row.address || undefined,
            notes: row.notes || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          result.errors.push({
            row: i + 2,
            phone: row.phone,
            error: updateError.message,
          });
        } else {
          result.skipped++; // Count updates as skipped since they already existed
        }
      } else {
        // Insert new contact
        const { error: insertError } = await supabase
          .from('contacts')
          .insert({
            account_id: accountId,
            phone,
            name: row.name || null,
            email: row.email || null,
            address: row.address || null,
            notes: row.notes || null,
            source: 'import',
            status: 'customer',
          });

        if (insertError) {
          result.errors.push({
            row: i + 2,
            phone: row.phone,
            error: insertError.message,
          });
        } else {
          result.imported++;
        }
      }
    }

    return successResponse({
      success: true,
      ...result,
      message: `Imported ${result.imported} contacts, ${result.skipped} updated, ${result.errors.length} errors`,
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    return handleError(error as Error);
  }
});

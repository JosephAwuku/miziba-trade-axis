import { supabaseAdmin } from '../supabase';

/**
 * Handles uploading the FDP PDF to Supabase Storage
 */
export async function uploadFDP(tradeId: string, buffer: Uint8Array): Promise<{ key: string; error: any }> {
  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin client not initialized');

    const filename = `fdp_${tradeId}_${Date.now()}.pdf`;
    const path = `${tradeId}/${filename}`;

    const { data: uploadData, error: uploadError } = await (supabaseAdmin.storage
      .from('fdp_documents') as any)
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) return { key: '', error: uploadError };

    return { key: path, error: null };
  } catch (err) {
    console.error('Storage upload failed:', err);
    return { key: '', error: err };
  }
}

/**
 * Generates a signed URL for a specific FDP document
 */
export async function getFDPSignedUrl(path: string): Promise<{ url: string; error: any }> {
  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin client not initialized');

    const { data, error } = await (supabaseAdmin.storage
      .from('fdp_documents') as any)
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) return { url: '', error };

    return { url: data.signedUrl, error: null };
  } catch (err) {
    console.error('Signed URL generation failed:', err);
    return { url: '', error: err };
  }
}

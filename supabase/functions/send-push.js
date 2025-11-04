import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: jsonHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST is allowed.' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const { user_id, title, body, reminder_id } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body are mandatory.' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { data: tokenRow, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('expo_token')
      .eq('user_id', user_id)
      .maybeSingle();

    if (tokenError) {
      throw tokenError;
    }

    if (!tokenRow?.expo_token) {
      return new Response(JSON.stringify({ error: 'Expo push token not found for the given user.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const pushPayload = {
      to: tokenRow.expo_token,
      sound: 'default',
      title,
      body,
      data: {
        screen: 'Reminders',
        reminderId: reminder_id ?? null,
      },
    };

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushPayload),
    });
    const pushResult = await pushResponse.json();

    if (!pushResponse.ok) {
      return new Response(JSON.stringify({ error: 'Expo push service returned an error.', details: pushResult }), {
        status: pushResponse.status,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, result: pushResult }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('send-push edge function failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Unexpected error while sending push notification.',
        details: error?.message ?? error,
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});


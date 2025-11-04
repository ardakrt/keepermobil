// Supabase Edge Function for sending high-priority Firebase push notifications
// This bypasses battery optimization on Android devices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY'); // FCM Server Key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const { reminderId, userId } = await req.json();

    // Get reminder details
    const { data: reminder, error: reminderError } = await supabase
      .from('reminders')
      .select('*')
      .eq('id', reminderId)
      .eq('user_id', userId)
      .single();

    if (reminderError) {
      return new Response(JSON.stringify({ error: 'Reminder not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's Firebase token
    const { data: userToken, error: tokenError } = await supabase
      .from('user_tokens')
      .select('firebase_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !userToken?.firebase_token) {
      return new Response(JSON.stringify({ error: 'User token not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send high-priority FCM message
    const fcmMessage = {
      to: userToken.firebase_token,
      priority: 'high', // Critical for bypassing battery optimization
      
      // Notification payload for immediate display
      notification: {
        title: 'Hatırlatıcı ⏰',
        body: reminder.title || 'Hatırlatma zamanı geldi!',
        sound: 'default',
        android_channel_id: 'reminders',
        priority: 'high',
        visibility: 'public',
        notification_priority: 'PRIORITY_HIGH',
      },
      
      // Data payload for app processing
      data: {
        type: 'reminder',
        reminderId: reminder.id,
        title: reminder.title,
        body: reminder.description || '',
        timestamp: new Date().toISOString(),
      },
      
      // Android-specific options for aggressive delivery
      android: {
        priority: 'high',
        ttl: '0s', // Deliver immediately, don't store
        restrictedPackageName: 'com.ardkaratas.test',
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'reminders',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
          notificationPriority: 'PRIORITY_HIGH',
        },
      },
      
      // Additional options
      content_available: true, // iOS background fetch
      mutable_content: true, // Allow modification
      time_to_live: 0, // Don't store if device is offline
    };

    // Send to Firebase Cloud Messaging
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${firebaseServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmMessage),
    });

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error('FCM error:', fcmResult);
      return new Response(JSON.stringify({ error: 'FCM send failed', details: fcmResult }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, fcmResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

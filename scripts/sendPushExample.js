/**
 * Example helper to trigger the Supabase edge function from a web or server environment.
 * Replace FUNCTION_URL with your deployed function endpoint and supply the correct values.
 */

const FUNCTION_URL = 'https://YOUR-PROJECT.functions.supabase.co/send-push';

async function triggerReminderPush() {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Optionally include service-role bearer token if your function is secured.
      // Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000000',
      title: 'Hatirlatma',
      body: 'Su icme zamani geldi.',
      reminder_id: '11111111-1111-1111-1111-111111111111',
    }),
  });

  const result = await response.json();
  console.log('Push result:', result);
}

triggerReminderPush().catch((err) => {
  console.error('Failed to trigger push function', err);
});

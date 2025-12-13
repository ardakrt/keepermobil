
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Firebase Service Account Bilgileri (Hardcoded - En garanti yöntem)
const FIREBASE_PROJECT_ID = 'ardaproje-c5f21';
const FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@ardaproje-c5f21.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7In7FtM/alOpV
OXUKMSKwKeUJ6Xez0UMbxrPW4xFuVPsxQet7tucII15EFofCcG+ptgEef4Dl4Lh1
HjOGT9PpZJ0yn7HxWbDU4DvM1qGcVuuKP5ljgTJ0WNXkphOBUPAaFUiOSPzVRw2g
J2vyRV2Hw2h4mHJX5GJDyVqLTb2ACBAryxLbVKLSkTRt6kcUlHJ6zVXypw2zYdg7
UpmLW9jwWJ5T30N2yvNGG50KpoYW33Q7tBbOk8RKzXggA4FTTCcBYCAy7HOPWcoJ
nSIXMj754qOQawyYwRZE3b2ANSzuxCJlRzv3Lvb214tgYY5ujVi5sZ1GxoYvZzwb
wKijFCc5AgMBAAECggEAB787iOf3P0dkVUd6wTbChsRDoplQAGY2RU6aQFgH7zQR
oa4aCqkwpeVM8DwPvh/VR5Ns0KK0c9yab+LI43navhh3t4V/InMB/1x4rUscLdkD
vD/tk8rgvoqBvfFjVyDbwVpGaPmIwGcshbsY3J+jHRoDJHoiXBTs10op91PH3gzY
dsxTY/146idrK8Uvh/qK7Zmr9XpwVV14TNz1f902+KTe5BjkvZ1w3q4mWSP5Q9Qh
ZibzhgY1nqwu1BXOczpij+Tal+FsLAlNmXTFsDGCP53Wzq01fe5shnk1dAnKKQY6
RD8/JZcvX710OzH42eP4YFsu1GRBcLZaIccQHLjmOQKBgQDkp2vZ8QDhpDNm5R8E
s+0XV2HYFbdIdoQrxzY9fZi4u6sk6Zh4ynOArZkh0wdEaNd9Wx9LhnzF8vd0GUPx
SMjc6tWaCzp77iZHcWChYMSTAFrOOUzdRIpmPa3sV6LSa7NzKyfUAlZNnjEHmdIW
DDcZBiK/y1PaUzrozEW125c0tQKBgQDRg+axFkD8jrh8rk4TYbaHKUn2BZ+hxyyR
nYS7PSpz7FbvqC0aqKnVCVIyNtPShIFJNv+BNEf6wl1jvsAnXhm0cJgL7mGZNeQu
SmAn9rH7d9aLMW4gihcI8OCojV6F/YhDk9hzP1j9ieb0MBudRZWVmf28aZjTh+AU
rtQZCtue9QKBgQDAnQQuYGWUroSabfIWPRdBLVv/8jMmOKgYVMUtQWrwWy7NdnX5
ctmfkR1JMAKULxkvwR34uj7LZWPsiggA7oY+CxiKnmDS2wel8S0sZF7TUl4sEHre
fgl0HQsw55YCWbWeE8GGR725vsOgmoQuDHYxf0iwdjCZ3rjmOIWUr3mNbQKBgEwi
WUdKpezg1AuCr559aH2vNFAxdPOt0/VKPzxnGrErVeAaxeElHynqDDNxFwIt4mk/
khNaczmdPaCMZXkoycB3FdloE5FAMx3bKxv6mmyd/JlyKemrJHm8RncZgBrCqayc
4g/nGihv3zwm6zH4YkYNwlWgLcfYXUZGzY4YEvytAoGAT/pK237REof7bb1tic2q
PaeUlPogOsVPimBcy2fLomefN6XqGgiX3xnL064qqN7L7xyn8fif9/tQbTa3k4jf
6SbEZzdA0hTpZ7CHFqw8Sui9j3TqfmErmObgGxE4YIOhtAaq/KDOLuYZQIowLETD
LAcds0OHH4xI770RnA88AJ4=
-----END PRIVATE KEY-----`;

// Private key'i CryptoKey formatına çevir
async function importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\n/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );
}

// Google OAuth2 access token al
async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const payload = {
        iss: FIREBASE_CLIENT_EMAIL,
        sub: FIREBASE_CLIENT_EMAIL,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    const key = await importPrivateKey(FIREBASE_PRIVATE_KEY);
    const jwt = await create(header, payload, key);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

// FCM v1 API ile bildirim gönder
async function sendFCMNotification(token: string, title: string, body: string, data: Record<string, string>) {
    const accessToken = await getAccessToken();

    const message = {
        message: {
            token: token,
            // Notification alanı - uygulama kapalıyken sistem bildirimi gösterir
            notification: {
                title: title,
                body: body,
            },
            android: {
                priority: 'high',
                direct_boot_ok: true,
                notification: {
                    channel_id: 'reminders',
                    default_vibrate_timings: true,
                    default_light_settings: true,
                    visibility: 'PUBLIC' as const,
                    // click_action kaldırıldı - default davranış uygulamayı açar
                },
            },
            // Data alanı - uygulama açıkken veya arka plandayken kullanılır
            data: {
                ...data,
                title: title,
                body: body,
                channelId: 'reminders',
            },
        },
    };

    console.log('Sending FCM message:', JSON.stringify(message));

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        }
    );

    const result = await response.json();
    console.log('FCM Response:', result);
    return result;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const payload = await req.json();
        console.log('Webhook payload received:', payload);

        // Webhook'tan gelen veri 'record' içindedir (INSERT trigger ise)
        const record = payload.record;

        if (!record || !record.user_id) {
            console.warn('No record or user_id in payload');
            return new Response(JSON.stringify({ message: 'Invalid payload' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userId = record.user_id;
        const requestId = record.id;

        // Kullanıcının token'ını bul
        const { data: userTokenData, error: tokenError } = await supabase
            .from('user_tokens')
            .select('firebase_token')
            .eq('user_id', userId)
            .maybeSingle();

        if (tokenError) {
            console.error('Token fetch error:', tokenError);
            throw tokenError;
        }

        if (!userTokenData || !userTokenData.firebase_token) {
            console.warn(`No firebase_token found for user ${userId}`);
            // Hata dönme, 200 dön ki webhook tekrar tekrar denemesin
            return new Response(JSON.stringify({ message: 'No device token found, skipping notification' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = userTokenData.firebase_token;
        const deviceInfo = record.device_info || 'Cihaz';
        const browserInfo = record.browser_info || 'Web Tarayıcı';

        // Bildirim detayları
        const title = '🔐 Web Giriş İsteği';
        const body = `${browserInfo} (${deviceInfo}) giriş onayı bekliyor.`;

        const data = {
            requestId: requestId,
            type: 'login_request',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            categoryIdentifier: 'LOGIN_REQUEST'
        };

        // Bildirimi gönder
        await sendFCMNotification(token, title, body, data);

        return new Response(JSON.stringify({ success: true, message: 'Notification sent' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

/**
 * Prefetch Service
 * Kullanıcı giriş yaptıktan sonra arka planda tüm ekranların verilerini yükler.
 * Bu sayede kullanıcı bir ekrana geçtiğinde verileri beklemek zorunda kalmaz.
 */

import { supabase } from './supabaseClient';
import { fetchMarketData } from './markets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Cache keys
const CACHE_KEYS = {
    MARKETS: 'prefetch_markets',
    SUBSCRIPTIONS: 'prefetch_subscriptions',
    OTP_CODES: 'prefetch_otp_codes',
    DRIVE_STATUS: 'prefetch_drive_status',
    LAST_PREFETCH: 'prefetch_timestamp',
};

// Cache duration - 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// In-memory cache for faster access
let memoryCache = {
    markets: null,
    subscriptions: null,
    otpCodes: null,
    driveConnected: null,
    lastPrefetch: null,
};

/**
 * Main prefetch function - call after successful login
 */
export async function prefetchAllData(userId) {
    if (!userId) {
        console.log('Prefetch: No user ID, skipping');
        return;
    }

    console.log('Prefetch: Starting background data loading...');
    const startTime = Date.now();

    try {
        // Run all prefetch operations in parallel
        await Promise.allSettled([
            prefetchMarkets(),
            prefetchSubscriptions(userId),
            prefetchOtpCodes(userId),
            prefetchDriveStatus(userId),
        ]);

        // Save prefetch timestamp
        const timestamp = Date.now();
        memoryCache.lastPrefetch = timestamp;
        await AsyncStorage.setItem(CACHE_KEYS.LAST_PREFETCH, timestamp.toString());

        const duration = Date.now() - startTime;
        console.log(`Prefetch: Completed in ${duration}ms`);
    } catch (error) {
        console.error('Prefetch: Error during background loading:', error);
    }
}

/**
 * Prefetch market data (piyasalar)
 */
async function prefetchMarkets() {
    try {
        console.log('Prefetch: Loading markets...');
        const result = await fetchMarketData();

        if (result.success && result.data) {
            memoryCache.markets = {
                data: result.data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(CACHE_KEYS.MARKETS, JSON.stringify(memoryCache.markets));
            console.log('Prefetch: Markets loaded successfully');
        }
    } catch (error) {
        console.error('Prefetch: Markets failed:', error);
    }
}

/**
 * Prefetch subscriptions (harcamalar/abonelikler)
 */
async function prefetchSubscriptions(userId) {
    try {
        console.log('Prefetch: Loading subscriptions...');
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            memoryCache.subscriptions = {
                data: data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(CACHE_KEYS.SUBSCRIPTIONS, JSON.stringify(memoryCache.subscriptions));
            console.log(`Prefetch: Subscriptions loaded (${data.length} items)`);
        }
    } catch (error) {
        console.error('Prefetch: Subscriptions failed:', error);
    }
}

/**
 * Prefetch OTP codes (2FA)
 */
async function prefetchOtpCodes(userId) {
    try {
        console.log('Prefetch: Loading OTP codes...');
        const { data, error } = await supabase
            .from('otp_codes')
            .select('id, service_name, account_name, issuer, bt_token_id_secret, algorithm, digits, period, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            memoryCache.otpCodes = {
                data: data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(CACHE_KEYS.OTP_CODES, JSON.stringify(memoryCache.otpCodes));
            console.log(`Prefetch: OTP codes loaded (${data.length} items)`);
        }
    } catch (error) {
        console.error('Prefetch: OTP codes failed:', error);
    }
}

/**
 * Check Drive connection status
 */
async function prefetchDriveStatus(userId) {
    try {
        console.log('Prefetch: Checking Drive status...');
        const tokenKey = `google_drive_token_${userId}`;
        const savedToken = await SecureStore.getItemAsync(tokenKey);

        const connected = !!savedToken;
        memoryCache.driveConnected = connected;

        // If connected, try to silently refresh token
        if (connected) {
            try {
                GoogleSignin.configure({
                    webClientId: '961544758987-fk2o1sujm7n3o55s23ku6u57tckfv7ij.apps.googleusercontent.com',
                    scopes: ['https://www.googleapis.com/auth/drive'],
                    offlineAccess: true,
                    forceCodeForRefreshToken: true,
                });

                const userInfo = await GoogleSignin.signInSilently();
                if (userInfo) {
                    const tokens = await GoogleSignin.getTokens();
                    if (tokens.accessToken) {
                        await SecureStore.setItemAsync(tokenKey, tokens.accessToken);
                        console.log('Prefetch: Drive token refreshed');
                    }
                }
            } catch (e) {
                // Silent refresh failed, user will need to re-auth when they go to Drive
                console.log('Prefetch: Drive silent refresh skipped');
            }
        }

        console.log(`Prefetch: Drive connected: ${connected}`);
    } catch (error) {
        console.error('Prefetch: Drive status check failed:', error);
    }
}

/**
 * Get cached markets data
 */
export function getCachedMarkets() {
    if (memoryCache.markets && isCacheValid(memoryCache.markets.timestamp)) {
        return memoryCache.markets.data;
    }
    return null;
}

/**
 * Get cached subscriptions data
 */
export function getCachedSubscriptions() {
    if (memoryCache.subscriptions && isCacheValid(memoryCache.subscriptions.timestamp)) {
        return memoryCache.subscriptions.data;
    }
    return null;
}

/**
 * Get cached OTP codes data
 */
export function getCachedOtpCodes() {
    if (memoryCache.otpCodes && isCacheValid(memoryCache.otpCodes.timestamp)) {
        return memoryCache.otpCodes.data;
    }
    return null;
}

/**
 * Check if Drive is connected
 */
export function isDriveConnected() {
    return memoryCache.driveConnected;
}

/**
 * Check if cache is still valid
 */
function isCacheValid(timestamp) {
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_DURATION;
}

/**
 * Restore cache from storage (call on app start)
 */
export async function restorePrefetchCache() {
    try {
        const [markets, subscriptions, otpCodes, lastPrefetch] = await Promise.all([
            AsyncStorage.getItem(CACHE_KEYS.MARKETS),
            AsyncStorage.getItem(CACHE_KEYS.SUBSCRIPTIONS),
            AsyncStorage.getItem(CACHE_KEYS.OTP_CODES),
            AsyncStorage.getItem(CACHE_KEYS.LAST_PREFETCH),
        ]);

        if (markets) memoryCache.markets = JSON.parse(markets);
        if (subscriptions) memoryCache.subscriptions = JSON.parse(subscriptions);
        if (otpCodes) memoryCache.otpCodes = JSON.parse(otpCodes);
        if (lastPrefetch) memoryCache.lastPrefetch = parseInt(lastPrefetch);

        console.log('Prefetch: Cache restored from storage');
    } catch (error) {
        console.error('Prefetch: Cache restore failed:', error);
    }
}

/**
 * Clear all prefetch cache (call on logout)
 */
export async function clearPrefetchCache() {
    try {
        memoryCache = {
            markets: null,
            subscriptions: null,
            otpCodes: null,
            driveConnected: null,
            lastPrefetch: null,
        };

        await Promise.all([
            AsyncStorage.removeItem(CACHE_KEYS.MARKETS),
            AsyncStorage.removeItem(CACHE_KEYS.SUBSCRIPTIONS),
            AsyncStorage.removeItem(CACHE_KEYS.OTP_CODES),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_PREFETCH),
        ]);

        console.log('Prefetch: Cache cleared');
    } catch (error) {
        console.error('Prefetch: Cache clear failed:', error);
    }
}

/**
 * Invalidate a specific cache
 */
export function invalidateCache(cacheKey) {
    switch (cacheKey) {
        case 'markets':
            memoryCache.markets = null;
            break;
        case 'subscriptions':
            memoryCache.subscriptions = null;
            break;
        case 'otpCodes':
            memoryCache.otpCodes = null;
            break;
    }
}

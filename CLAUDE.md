# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kişisel Not Kasası** (Personal Note Vault) - A React Native mobile application built with Expo that provides secure personal data management. The app features notes, reminders, wallet/card storage, account credentials, and IBAN management, all protected with Row Level Security (RLS) via Supabase.

## Language Requirement

**IMPORTANT**: According to `rules.md`, all communication must be in Turkish ("Her zaman türkçe konuş").

## Development Commands

### Running the App
```powershell
# Install dependencies
npm install

# Start Expo dev server
npm run start

# Run on Android
npm run android

# Run with dev client (recommended for native modules)
npm run dev

# Run dev client on Android
npm run dev:android

# Run on iOS
npm run ios

# Run web version
npm run web
```

### EAS Build
Development build with APK output:
```powershell
eas build --profile development --platform android
```

Production build:
```powershell
eas build --profile production --platform android
```

### Testing RLS Policies
```powershell
# Set required environment variables
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"
$env:TEST_USER_A_EMAIL = "user_a@example.com"
$env:TEST_USER_A_PASSWORD = "passwordA"
$env:TEST_USER_B_EMAIL = "user_b@example.com"
$env:TEST_USER_B_PASSWORD = "passwordB"

# Run RLS test script
node scripts/test-rls.js
```

## Environment Setup

### Required Environment Variables (.env)
```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

These are loaded via `app.config.js` which resolves credentials from both `process.env` and Expo Constants.

### Supabase Schema
Run `supabase/schema.sql` in Supabase SQL Editor to create:
- Tables: `notes`, `reminders`, `cards`, `accounts`, `ibans`, `user_tokens`
- RLS policies for all tables (owner-only access via `auth.uid()`)

Optionally run `supabase/migrations/2025-10-15-rls-user_tokens.sql` for idempotent RLS on `user_tokens`.

### Firebase Configuration
- `google-services.json` is required for Firebase Cloud Messaging (FCM)
- For EAS builds, use a FILE secret (e.g., `GOOGLE_SERVICES_JSON`) to avoid committing credentials
- The `app.config.js` dynamically resolves the path from environment variables

## Architecture

### Application Structure

#### Entry Point (`index.js`)
- Registers Firebase background message handler at the top level (required for Android)
- Registers the root `App` component

#### Main App (`App.js`)
- **Context Providers** (nested):
  1. `ThemeProvider` - Theme management (light/dark/system, custom accent colors)
  2. `ConfirmProvider` - Confirmation dialogs
  3. `ToastProvider` - Toast notifications
  4. `HUDProvider` - Loading HUD overlay
  5. `PrefsProvider` - User preferences (haptics, reduce motion)
  6. `BadgeProvider` - Badge counts for tabs (e.g., reminder count)
  7. `SafeAreaProvider` - Safe area insets

- **Navigation Structure**:
  - `RootStack` (Native Stack):
    - `Main` (Bottom Tabs) - shown when authenticated
    - `Auth` - login/signup screen
    - `Profile` - modal profile screen
    - `ResetPassword` - password reset flow
  - `Main` uses custom `BlurredTabBar` with blur effect, animated indicators, and haptic feedback
  - Tabs: Notes (with nested stack for detail), Reminders, Cüzdan (Wallet), Settings

#### Session Management
- Session persistence uses:
  - **AsyncStorage** for "remember me" functionality (`SESSION_KEY`)
  - **SecureStore** for biometric authentication (`BIOMETRIC_SESSION_KEY`)
- Biometric auth flow:
  1. Check if biometric is enabled and device supports it (`localAuth.hasFullSupport()`)
  2. If yes, prompt for fingerprint/face authentication
  3. Restore session from `SecureStore` on success
- Deep linking handles password recovery URLs (`type=recovery` or `params.code`)

#### Push Notifications
- **Dual notification system**:
  1. **Expo Notifications**: token stored in `user_tokens.expo_token`
  2. **Firebase Cloud Messaging**: token stored in `user_tokens.firebase_token`
- Notification permissions requested after login
- Foreground notifications show custom toast banner
- Background/quit notifications handled by Firebase background handler in `index.js`
- Deep link navigation on notification tap (e.g., `screen: 'Reminders', reminderId: '...'`)

#### Theme System (`lib/theme.js`)
- Three modes: `light`, `dark`, `system` (follows OS)
- Custom accent color support (hex color override for `primary`)
- Theme preferences synced to Supabase `user_tokens` table (`theme_mode`, `accent_color`)
- Navigation theme generated via `makeNavTheme()` for React Navigation

#### Supabase Client (`lib/supabaseClient.js`)
- Configured with `persistSession: false` - session management is manual via AsyncStorage/SecureStore
- Credentials resolved from `process.env.EXPO_PUBLIC_*` or `Constants.expoConfig.extra`
- Logs Supabase host on initialization for diagnostics

#### Screen Organization
- **AuthScreen**: Login/signup with "remember me" and biometric enrollment
- **NotesScreen** → **NoteDetailScreen**: Full CRUD for notes
- **RemindersScreen**: Reminders with push notification scheduling via `expo-notifications`
- **WalletScreen**: Tabbed interface for Cards, Accounts, IBANs
  - Cards/Accounts use encrypted fields (`*_enc` columns) for sensitive data
- **SettingsScreen**: Theme, haptics, reduce motion, biometric toggle, logout
- **ProfileScreen**: User profile (modal)
- **ResetPasswordScreen**: Password reset via email link

### Data Flow Patterns

1. **Real-time Subscriptions**: Screens subscribe to Supabase real-time channels for their respective tables (e.g., `notes:user_id=eq.${userId}`)
2. **Optimistic Updates**: Many screens immediately update local state, then sync to Supabase
3. **RLS Enforcement**: All tables enforce `auth.uid() = user_id` for both read and write
4. **Notification Scheduling**: `reminderNotificationStore.js` maps reminder IDs to notification IDs for cancellation

### Utility Libraries

- `lib/localAuth.js` - Safe wrapper around `expo-local-authentication` with fallback for unsupported devices
- `lib/storageKeys.js` - Centralized constants for AsyncStorage/SecureStore keys
- `lib/confirm.js` - Context provider for confirmation dialogs
- `lib/toast.js` - Context provider for toast notifications
- `lib/hud.js` - Context provider for loading overlay
- `lib/badges.js` - Context provider for tab badge counts
- `lib/prefs.js` - Context provider for user preferences (haptics, motion)
- `lib/links.js` - Deep linking utilities
- `lib/reminderNotificationStore.js` - AsyncStorage persistence for reminder→notification mapping

### Component Patterns

- **Reusable Components** in `components/`:
  - `Screen.js` - Standard screen wrapper with safe area
  - `Input.js` - Themed text input
  - `Button.js` - Themed button with loading state
  - `Card.js` - Card container
  - `Avatar.js` - User avatar with fallback initials
  - `BlurHeader.js` - Blur header component
- All components use hooks for theme (`useAppTheme`), preferences (`usePrefs`), toasts (`useToast`), etc.

### Security Considerations

- **Never commit**: `fcm-service-account.json`, `google-services.json`, `.env`
- **Sensitive data encryption**: Card numbers, CVCs, passwords stored in `*_enc` columns (app-level encryption recommended)
- **RLS policies**: Every table enforces user ownership via `auth.uid()`
- **Biometric storage**: Session tokens in SecureStore only when biometric auth is enabled

### Common Pitfalls

1. **Supabase credentials**: Ensure `.env` is set or `app.config.js` will resolve to undefined
2. **Firebase background handler**: Must be registered in `index.js` before `registerRootComponent`
3. **Biometric auth**: Only works on physical devices, not simulators/emulators
4. **RLS testing**: Use `scripts/test-rls.js` to verify policies before production
5. **Theme sync**: Theme changes trigger Supabase upsert - ensure `user_tokens` table exists with `theme_mode` and `accent_color` columns

### Platform-Specific Notes

- **Android**:
  - `google-services.json` required for FCM
  - Background notification handler registered in `index.js`
  - Dev builds use APK format (`eas.json`)
- **iOS**:
  - Requires provisioning profile for dev client builds
  - Biometric auth requires Face ID/Touch ID permissions in `app.json`

### Testing Strategy

- **RLS Verification**: `scripts/test-rls.js` creates two users and verifies cross-user isolation
- **Push Notifications**: `scripts/sendPushExample.js` demonstrates sending via Expo Push API
- **Edge Function**: `supabase/functions/send-push.js` server-side push notification example

### Migration Notes

- Schema changes: Add new SQL files to `supabase/migrations/` with idempotent `DO $$ BEGIN ... END $$` blocks
- New tables: Always add RLS policy with `auth.uid() = user_id` pattern
- New features requiring tokens: Update `user_tokens` table structure and adjust upsert logic in `App.js`

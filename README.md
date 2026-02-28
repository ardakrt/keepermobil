# KeeperMobil: Personal Note Vault (Expo + Supabase)

**KeeperMobil** is a feature-rich, cross-platform mobile application built with **Expo (React Native)** and **Supabase**. It provides a secure environment for managing notes, reminders, cards, and sensitive account information with robust authentication and data synchronization.

---

## Installation

### 1. Install Dependencies
npm install

### 2. Environment Variables (.env)
Create a `.env` file in the root directory and fill in your Supabase credentials (refer to `.env.example`):
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

### 3. Supabase Schema and Policies
1. Copy the content of `supabase/schema.sql` and run it in the Supabase SQL Editor. This will initialize the tables and core Row Level Security (RLS) policies.
2. Additionally, apply the idempotent migration found in `supabase/migrations/2025-10-15-rls-user_tokens.sql` to set up detailed RLS for the `public.user_tokens` table.

### 4. Development
npm run start

To run on Android:
npm run android

---

## Notifications

- Expo Notifications: Utilizes the `user_tokens.expo_token` field for standard push delivery.
- Firebase Messaging (FCM): Managed via the `user_tokens.firebase_token` field. The Android background message handler is registered in `index.js`.

---

## Security Notes

- Secret Management: Sensitive files like `fcm-service-account.json` and `google-services.json` are excluded from version control via `.gitignore`.
- Key Safety: Supabase keys are managed through environment variables instead of hardcoding them in `app.json`.
- Data Isolation: Every table is protected by RLS, ensuring users can only access their own records (`auth.uid()`).

---

## Directory Structure

- lib/: Supabase client configuration, local auth logic, and storage keys.
- screens/: Core application views (Notes, Reminders, Cards, Accounts, Ibans, Settings).
- supabase/: Edge functions examples and database schema definitions.
- scripts/: Utility scripts for testing and maintenance.

---

## Troubleshooting

- FCM: Ensure the background handler is correctly registered in `index.js` for Android devices.
- Realtime: Verify that Supabase RLS policies are enabled and correctly matching `auth.uid()`.

---

## RLS & Quick Testing (Optional)

To ensure the security layer is functioning correctly, you can use the built-in testing utility `scripts/test-rls.js`.

### PowerShell Examples:
# Required
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"

# Test user credentials
$env:TEST_USER_A_EMAIL = "user_a@example.com"
$env:TEST_USER_A_PASSWORD = "passwordA"
$env:TEST_USER_B_EMAIL = "user_b@example.com"
$env:TEST_USER_B_PASSWORD = "passwordB"

node scripts/test-rls.js

The script validates that signed-out access is blocked, users can only view their own data, and unauthorized upsert attempts are rejected.

---


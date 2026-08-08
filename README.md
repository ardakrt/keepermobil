<div align="center">

  <h1>KeeperMobil</h1>

  <p><strong>Personal Vault & Data Security Platform</strong></p>

  <p>
    A high-security, cross-platform mobile application built with React Native, Expo, and Supabase. Protect notes, reminders, cards, and account credentials with end-to-end Row Level Security.
  </p>

  <p>
    <a href="https://expo.dev"><img src="https://img.shields.io/badge/Expo-v54.0-1C1C1E?style=flat-square&logo=expo" alt="Expo" /></a>
    <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/React_Native-v0.81-1C1C1E?style=flat-square&logo=react" alt="React Native" /></a>
    <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Database_%26_RLS-1C1C1E?style=flat-square&logo=supabase" alt="Supabase" /></a>
    <a href="https://firebase.google.com"><img src="https://img.shields.io/badge/Firebase-FCM-1C1C1E?style=flat-square&logo=firebase" alt="Firebase" /></a>
    <a href="https://github.com/ardakrt/keepermobil/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-1C1C1E?style=flat-square" alt="License" /></a>
  </p>

  <br />

</div>

---

### Overview

KeeperMobil is a modern mobile client designed to provide secure, isolated storage for sensitive personal information. Utilizing Supabase Row Level Security (RLS) alongside local biometric authentication, it ensures that your data remains strictly accessible only by you.

---

### Key Features

- **Secure Notes & Reminders** — Real-time data synchronization backed by Supabase PostgreSQL, featuring local scheduled push notifications.
- **Encrypted Digital Wallet** — Isolated storage for credit cards, bank accounts, and IBANs with client-side field encryption.
- **Biometric Access Control** — Native integration with Face ID and Fingerprint authentication via `expo-local-authentication`.
- **Zero-Trust Security Model** — Full database protection utilizing strict `auth.uid()` Row Level Security policies across all tables.
- **Dual Notification Engine** — Seamless handling of foreground and background alerts via Expo Notifications and Firebase Cloud Messaging (FCM).
- **Adaptive Interface** — System-aware dark/light mode engine with customizable accent palettes and haptic feedback.

---

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React Native (v0.81), Expo (v54.0) |
| **Navigation** | React Navigation (Native Stack, Blurred Tab Bar) |
| **Backend & Auth** | Supabase (PostgreSQL, Row Level Security) |
| **Notifications** | Expo Notifications, Firebase Cloud Messaging (FCM) |
| **Security & Storage** | Expo SecureStore, AsyncStorage, App-level Field Encryption |
| **UI Components** | React Native Reanimated, Lucide Icons, Expo Blur |

---

### Project Structure

```
keepermobil/
├── assets/                  # Application branding and media assets
├── components/              # Atomic UI components (Buttons, Inputs, Cards, BlurHeader)
├── lib/                     # Theme engine, Supabase client, auth helpers, notifications
├── screens/                 # Core navigation screens
│   ├── AuthScreen.js        # Authentication & Biometric login
│   ├── NotesScreen.js       # Notes management & real-time sync
│   ├── RemindersScreen.js   # Scheduled alerts & reminders
│   ├── WalletScreen.js      # Encrypted cards, accounts & IBANs
│   ├── SettingsScreen.js    # User preferences, themes & security settings
│   └── ProfileScreen.js     # User profile modal
├── scripts/                 # Automated RLS validation scripts
└── supabase/                # Database schemas, RLS policies & edge functions
```

---

### Getting Started

#### Prerequisites

- Node.js (v18 or higher)
- Expo Go app or iOS/Android emulator
- Supabase project instance

#### 1. Repository Setup

```bash
git clone https://github.com/ardakrt/keepermobil.git
cd keepermobil
npm install
```

#### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

#### 3. Database Initialization

Execute `supabase/schema.sql` in your Supabase SQL Editor to initialize core tables and RLS policies. Optionally apply `supabase/migrations/2025-10-15-rls-user_tokens.sql` for user token policies.

#### 4. Run Development Server

```bash
# Start Expo development server
npm run start

# Launch on Android emulator / device
npm run android

# Launch on iOS simulator
npm run ios
```

---

### Security & RLS Verification

> [!NOTE]
> All database access is governed by Supabase Row Level Security policies (`auth.uid() = user_id`), ensuring complete data isolation per user.

To verify policy enforcement, run the automated RLS test suite:

```powershell
$env:SUPABASE_URL = "https://<project-id>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"
$env:TEST_USER_A_EMAIL = "user_a@example.com"
$env:TEST_USER_A_PASSWORD = "passwordA"
$env:TEST_USER_B_EMAIL = "user_b@example.com"
$env:TEST_USER_B_PASSWORD = "passwordB"

node scripts/test-rls.js
```

---

### Build & Deployment

Building standalone APK or App Bundle binaries using EAS Build:

```bash
# Development build (APK)
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

---

### License

Distributed under the MIT License. See `LICENSE` for details.

<div align="center">
  <br />
  <sub>Maintained by <a href="https://github.com/ardakrt">@ardakrt</a></sub>
</div>

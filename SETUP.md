# AstraChat - Setup Guide

## 🚀 Cara Setup

### 1. Prerequisites
- Node.js 18+
- NPM
- Akun Supabase (gratis di [supabase.com](https://supabase.com))

### 2. Setup Supabase

1. **Buat project baru** di [Supabase Dashboard](https://app.supabase.com)

2. **Jalankan SQL Schema:**
   - Buka **SQL Editor** di Supabase Dashboard
   - Copy paste seluruh isi file `supabase_schema.sql`
   - Klik **Run**

3. **Setup Storage Buckets:**
   - Buckets sudah otomatis dibuat oleh SQL (`avatars`, `group-avatars`, `note-files`, `chat-files`)
   - Jika gagal, buat manual di **Storage** > **New bucket**

4. **Setup Auth:**
   - Buka **Authentication** > **Providers**
   - Pastikan **Email** provider aktif
   - (Opsional) Matikan **Confirm email** di Settings > Auth untuk testing

5. **Ambil API Keys:**
   - Buka **Settings** > **API**
   - Copy **Project URL** dan **anon/public key**

### 3. Setup Project

```bash
# Clone / masuk ke folder project
cd AstraChat

# Install dependencies (sudah otomatis jika baru dibuat)
npm install

# Buat file .env
cp .env.example .env
```

### 4. Isi Environment Variables

Edit file `.env`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

### 5. Jalankan

```bash
npm run dev
```

Buka di browser: `http://localhost:5173`

## 📋 Fitur

| Fitur | Status |
|-------|--------|
| Register & Login | ✅ |
| Auto session detect | ✅ |
| Protected routes | ✅ |
| Profile CRUD | ✅ |
| Avatar upload | ✅ |
| Phone masking | ✅ |
| Phone search teman | ✅ |
| Friend request system | ✅ |
| Buat/join group | ✅ |
| Invite code | ✅ |
| Role (owner/admin/member) | ✅ |
| Chat realtime | ✅ |
| Chat terenkripsi (AES-GCM) | ✅ |
| Kirim file di chat | ✅ |
| Catatan/tugas CRUD | ✅ |
| Upload file di catatan | ✅ |
| Komentar di catatan | ✅ |
| Kategori & filter catatan | ✅ |
| Search catatan | ✅ |
| RLS (Row Level Security) | ✅ |
| Dark mode | ✅ |
| Responsive (Mobile + Desktop) | ✅ |
| Sidebar (desktop) | ✅ |
| Bottom nav (mobile) | ✅ |

## 🔒 Keamanan

- **Enkripsi Chat**: AES-256-GCM via Web Crypto API
- **RLS**: Row Level Security di semua tabel
- **Phone Masking**: Nomor HP tidak ditampilkan full (0812****7890)
- **Storage Policies**: User hanya bisa upload ke folder sendiri
- **Session Management**: Auto refresh token via Supabase Auth

## 🏗️ Tech Stack

- React 18 + Vite
- Tailwind CSS v4
- Supabase (Auth, Database, Storage, Realtime)
- React Router DOM v6
- Lucide React (icons)
- Web Crypto API (encryption)

## 📁 Struktur Folder

```
src/
├── lib/          # Library & utilities
├── components/   # Komponen reusable
├── layouts/      # Layout templates
├── pages/        # Halaman
└── routes/       # Konfigurasi routing
```

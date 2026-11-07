#!/usr/bin/env bash
# One-shot wipe: logs, users except the admin, companies, and uploaded files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/scripts/blank-slate.mjs" ]]; then
  echo "scripts/blank-slate.mjs پیدا نشد. این فایل را از ریشهٔ پروژه اجرا کنید." >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "فایل .env کنار wipe.sh نیست. DATABASE_URL باید همان‌جا باشد." >&2
  exit 1
fi

export SHIDVAR_BLANK_FORCE=1
node "$ROOT/scripts/blank-slate.mjs"
echo "تمام شد. فقط مدیر مانده است. سفارش‌ها، کاربران، لاگ‌ها و فایل‌های آپلود پاک شدند."

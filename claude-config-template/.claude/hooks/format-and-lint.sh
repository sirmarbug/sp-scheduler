#!/usr/bin/env bash
# PostToolUse hook: wykrywa stack projektu i uruchamia dostępny format/lint.
# Nigdy nie failuje hooka — brak narzędzia = ostrzeżenie, nie błąd.

set -uo pipefail

warn() {
  echo "[format-and-lint] ostrzeżenie: $1" >&2
}

run_if_exists() {
  local bin="$1"
  shift
  if command -v "$bin" >/dev/null 2>&1; then
    "$bin" "$@" || warn "polecenie '$bin $*' zakończyło się błędem (ignoruję)"
    return 0
  fi
  return 1
}

PROJECT_ROOT="$(pwd)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  warn "nie znaleziono package.json w $PROJECT_ROOT — pomijam format/lint"
  exit 0
fi

HAS_ESLINT=false
HAS_PRETTIER=false

if [ -f "$PROJECT_ROOT/.eslintrc" ] || [ -f "$PROJECT_ROOT/.eslintrc.js" ] || \
   [ -f "$PROJECT_ROOT/.eslintrc.cjs" ] || [ -f "$PROJECT_ROOT/.eslintrc.json" ] || \
   grep -q '"eslintConfig"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
  HAS_ESLINT=true
fi

if [ -f "$PROJECT_ROOT/.prettierrc" ] || [ -f "$PROJECT_ROOT/.prettierrc.js" ] || \
   [ -f "$PROJECT_ROOT/.prettierrc.json" ] || [ -f "$PROJECT_ROOT/prettier.config.js" ] || \
   grep -q '"prettier"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
  HAS_PRETTIER=true
fi

PKG_MANAGER="npm"
if [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ]; then
  PKG_MANAGER="pnpm"
elif [ -f "$PROJECT_ROOT/yarn.lock" ]; then
  PKG_MANAGER="yarn"
fi

if [ "$HAS_PRETTIER" = true ]; then
  if ! run_if_exists npx prettier --write . --loglevel warn; then
    warn "prettier nie jest zainstalowany — pomijam formatowanie"
  fi
else
  warn "brak konfiguracji prettier — pomijam formatowanie"
fi

if [ "$HAS_ESLINT" = true ]; then
  if ! run_if_exists npx eslint . --fix; then
    warn "eslint nie jest zainstalowany — pomijam lintowanie"
  fi
else
  warn "brak konfiguracji eslint — pomijam lintowanie"
fi

# Placeholder pod przyszłe stacki (np. Python/Ruby) — do rozbudowy w razie potrzeby.
# <!-- TODO: uzupełnij, jeśli projekt korzysta z innych narzędzi niż eslint/prettier -->

exit 0

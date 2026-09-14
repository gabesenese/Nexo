#!/usr/bin/env bash
# PostToolUse hook for backend-implementer: after any Edit/Write, enforce
# TypeScript strict mode and run the server test suite. Fails loudly.
set -euo pipefail

cd "$(dirname "$0")/../.." # repo root
SERVER_DIR="packages/server"

if [ ! -d "$SERVER_DIR" ]; then
  echo "verify-strict.sh: $SERVER_DIR not found, skipping" >&2
  exit 0
fi

cd "$SERVER_DIR"

echo "== verify-strict: typecheck ==" >&2
if ! npm run typecheck --silent; then
  echo "" >&2
  echo "VERIFY-STRICT FAILED: TypeScript strict-mode typecheck did not pass." >&2
  echo "Do not report this change as done until 'npm run typecheck' is clean." >&2
  exit 1
fi

echo "== verify-strict: tests ==" >&2
if ! npm run test --silent; then
  echo "" >&2
  echo "VERIFY-STRICT FAILED: test suite did not pass." >&2
  echo "Do not report this change as done until 'npm run test' is clean." >&2
  exit 1
fi

echo "== verify-strict: OK ==" >&2

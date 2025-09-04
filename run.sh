#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Installing pnpm dependencies ---"
pnpm install --recursive

echo "--- Generating ConnectRPC service code ---"
# Ensure the proto directory exists in the backend
mkdir -p backend/proto

# Ensure output directories exist for generated code
mkdir -p backend/src/gen
mkdir -p frontend/src/gen

# Add the local node_modules/.bin to the PATH for the protoc command
# This allows protoc to find the plugins (protoc-gen-es, protoc-gen-connect-es)
# that were installed by pnpm.
# We use a subshell (parens) to temporarily modify PATH for each protoc call.

# Generate backend service stubs and messages
(
  # Temporarily add backend's local pnpm bin directory to PATH
  export PATH="$(cd backend && pnpm bin):$PATH"
  echo "Generating backend service stubs and messages..."
  protoc \
    --es_out backend/src/gen \
    --es_opt target=ts \
    --connect-es_out backend/src/gen \
    --connect-es_opt target=ts \
    --connect-es_opt import_extension=.ts \
    --proto_path backend/proto \
    backend/proto/app.proto
)

# Generate frontend service stubs and messages
(
  # Temporarily add frontend's local pnpm bin directory to PATH
  export PATH="$(cd frontend && pnpm bin):$PATH"
  echo "Generating frontend service stubs and messages..."
  protoc \
    --es_out frontend/src/gen \
    --es_opt target=ts \
    --connect-es_out frontend/src/gen \
    --connect-es_opt target=ts \
    --connect-es_opt import_extension=.ts \
    --proto_path backend/proto \
    backend/proto/app.proto
)


echo "--- Starting Backend Server ---"
# Run backend in the background
pnpm --filter backend dev &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

echo "--- Starting Frontend Server ---"
# Run frontend in the background
pnpm --filter frontend dev &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo "--- Servers are running. Press Ctrl+C to stop them ---"

# Wait for both background processes to finish (e.g., when Ctrl+C is pressed)
wait $BACKEND_PID $FRONTEND_PID

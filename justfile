# Load .env and .env.local files if they exist

set dotenv-load := true
set dotenv-filename := '.env.local'

# --- SETUP COMMANDS ---

# Install dependencies for basic setup
depsetup:
    ./.vscode/setup.sh

# Setup pnpm and install dependencies
pnpmsetup:
    which pnpm && pnpm i

# Update @decky/ui (Decky Frontend Library)
updatefrontendlib:
    pnpm update @decky/ui --latest

# Complete setup - dependencies, pnpm, and update Decky Frontend Library
setup:
    just depsetup
    just pnpmsetup
    just updatefrontendlib

# Check that settings.json has been created
settingscheck:
    ./.vscode/config.sh

# --- BUILD COMMANDS ---

# Build plugin with CLI
cli-build:
    ./.vscode/build.sh

# Full build - setup, settings check, and build
build: setup settingscheck cli-build

# --- DEPLOY COMMANDS ---

# Change permissions on plugins folder to prevent issues
chmodplugins:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY} \
      "echo '${DECK_PASS}' | sudo -S chown ${DECK_USER} ${DECK_DIR}/homebrew/plugins/"

# Copy plugin zip to Steam Deck
copyzip: chmodplugins
    rsync -azp --chmod=D0755,F0755 --rsh="ssh -p ${DECK_PORT} ${DECK_KEY}" \
      out/ ${DECK_USER}@${DECK_IP}:${DECK_DIR}/homebrew/plugins

# Extract plugin zip on Steam Deck
extractzip:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY} \
      "echo ${DECK_PASS} | sudo -S mkdir -m 755 -p \"\$(echo '${DECK_DIR}/homebrew/plugins/${PLUGIN_UNZIP_NAME}')\" && \
       echo ${DECK_PASS} | sudo -S chown ${DECK_USER}:${DECK_USER} \"\$(echo '${DECK_DIR}/homebrew/plugins/${PLUGIN_UNZIP_NAME}')\" && \
       echo ${DECK_PASS} | sudo -S bsdtar -xzpf '${DECK_DIR}/homebrew/plugins/${PLUGIN_NAME}.zip' \
       -C \"\$(echo '${DECK_DIR}/homebrew/plugins/${PLUGIN_UNZIP_NAME}' | sed 's| |-|g')\" --strip-components=1 --fflags"

# Deploy plugin to Steam Deck (copy and extract)
deploy: copyzip extractzip

# Build and deploy plugin to Steam Deck
builddeploy: build deploy

# --- UTILITY COMMANDS ---

# Display all environment variables for debugging
env:
    @echo "DECK_IP=${DECK_IP}"
    @echo "DECK_PORT=${DECK_PORT}"
    @echo "DECK_USER=${DECK_USER}"
    @echo "DECK_PASS=${DECK_PASS}"
    @echo "DECK_KEY=${DECK_KEY}"
    @echo "DECK_DIR=${DECK_DIR}"
    @echo "PLUGIN_NAME=${PLUGIN_NAME}"

# Restart Decky Loader on Steam Deck
restartdecky:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY} \
      "echo '${DECK_PASS}' | sudo -S systemctl restart plugin_loader"

connect:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY}

logs:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY} \
      "echo '${DECK_PASS}' | journalctl -u plugin_loader -f"

rundebug:
    ssh ${DECK_USER}@${DECK_IP} -p ${DECK_PORT} ${DECK_KEY} \
      "echo '${DECK_PASS}' | nano .dlo/debug.log"

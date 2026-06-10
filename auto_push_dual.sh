#!/bin/bash

# Dual-Repository Auto-Push Script
# Automatically commits changes and pushes to both HaloIT-Platform and Haloitservices365
# Usage: ./auto_push_dual.sh "commit message" [--no-verify]

set -e

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_MSG="${1:-Auto update: $TIMESTAMP}"
NO_VERIFY="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Dual Repository Auto-Push${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to check if we're in a git repo
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository${NC}"
        exit 1
    fi
}

# Function to check SSH key availability
check_ssh_keys() {
    echo -e "${YELLOW}Checking SSH key configuration...${NC}"
    
    if [ ! -f ~/.ssh/haloit-platform-key ]; then
        echo -e "${RED}Error: ~/.ssh/haloit-platform-key not found${NC}"
        exit 1
    fi
    
    if [ ! -f ~/.ssh/haloitservices-key ]; then
        echo -e "${RED}Error: ~/.ssh/haloitservices-key not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ SSH keys found${NC}"
}

# Function to check for uncommitted changes
check_changes() {
    if git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}No changes to commit${NC}"
        return 1
    fi
    return 0
}

# Function to stage all changes
stage_changes() {
    echo -e "${BLUE}Staging changes...${NC}"
    git add -A
    STAGED=$(git diff --cached --name-only | wc -l)
    echo -e "${GREEN}✓ Staged $STAGED file(s)${NC}"
}

# Function to commit changes
commit_changes() {
    echo -e "${BLUE}Committing changes...${NC}"
    git commit -m "$COMMIT_MSG" $NO_VERIFY
    COMMIT_HASH=$(git rev-parse --short HEAD)
    echo -e "${GREEN}✓ Committed as $COMMIT_HASH${NC}"
}

# Function to push to a remote
push_to_remote() {
    local REMOTE=$1
    echo -e "${BLUE}Pushing to $REMOTE...${NC}"
    
    if git push $REMOTE main 2>&1; then
        echo -e "${GREEN}✓ Successfully pushed to $REMOTE${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to push to $REMOTE${NC}"
        return 1
    fi
}

# Main execution
main() {
    check_git_repo
    check_ssh_keys
    
    if ! check_changes; then
        exit 0
    fi
    
    stage_changes
    commit_changes
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Pushing to Remote Repositories${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    PUSH_SUCCESS=true
    
    # Try to push to origin (HaloIT-Platform)
    if ! push_to_remote "origin"; then
        PUSH_SUCCESS=false
    fi
    
    # Try to push to haloitservices
    if ! push_to_remote "haloitservices"; then
        PUSH_SUCCESS=false
    fi
    
    echo -e "${BLUE}========================================${NC}"
    
    if [ "$PUSH_SUCCESS" = true ]; then
        echo -e "${GREEN}✓ Successfully pushed to all remotes${NC}"
        echo -e "${BLUE}Commit: $COMMIT_MSG${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some remotes failed to push${NC}"
        echo -e "${YELLOW}Review errors above and retry${NC}"
        exit 1
    fi
}

main "$@"

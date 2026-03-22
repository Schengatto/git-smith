#!/bin/bash
# Generate a test git repository with branches, merges, and various file states
# Usage: ./scripts/generate-test-repo.sh [target-dir]

set -e

TARGET="${1:-/tmp/gitsmith-test-repo}"

rm -rf "$TARGET"
mkdir -p "$TARGET"
cd "$TARGET"

git init -b main
git config user.email "test@test.com"
git config user.name "Test User"

# Initial commits
echo "# Test Project" > README.md
git add README.md
git commit -m "Initial commit"

echo "console.log('hello');" > index.js
git add index.js
git commit -m "Add index.js"

echo "body { margin: 0; }" > style.css
git add style.css
git commit -m "Add styles"

# Create a feature branch
git checkout -b feature/auth
echo "function login() {}" >> index.js
git add index.js
git commit -m "Add login function"

echo "function logout() {}" >> index.js
git add index.js
git commit -m "Add logout function"

# Back to main, make some changes (different file to avoid conflict)
git checkout main
echo ".container { display: flex; }" >> style.css
git add style.css
git commit -m "Update styles on main"

# Merge feature branch
git merge feature/auth -m "Merge feature/auth into main"

# Create another branch
git checkout -b feature/dashboard
echo "<div>Dashboard</div>" > dashboard.html
git add dashboard.html
git commit -m "Add dashboard page"

echo "<div>Dashboard v2</div>" > dashboard.html
git add dashboard.html
git commit -m "Update dashboard"

# Back to main
git checkout main
echo "/* reset */" >> style.css
git add style.css
git commit -m "Update styles"

# Create some tags
git tag v1.0.0 -m "Version 1.0.0"
git tag v0.1.0 HEAD~3

# Create a stash
echo "// Work in progress" >> index.js
git stash push -m "WIP: some feature"

# Leave some uncommitted changes
echo "// Uncommitted change" >> index.js
echo "new-file.txt" > new-file.txt

echo ""
echo "Test repo created at: $TARGET"
echo "Branches: $(git branch --list | tr '\n' ' ')"
echo "Tags: $(git tag --list | tr '\n' ' ')"
echo "Stashes: $(git stash list)"
echo "Status:"
git status --short

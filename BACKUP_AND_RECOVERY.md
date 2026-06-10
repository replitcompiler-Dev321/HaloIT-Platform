# Backup Repositories & Recovery Guide

## Overview

Two backup repositories have been created to protect your work:

1. **Full Clone Backups** (in `/tmp/`)
   - HaloIT-Platform-backup
   - Haloitservices-backup

2. **Remote Backups** (on GitHub)
   - Primary: replitcompiler-Dev321/HaloIT-Platform
   - Backup: HaloAdmin365/Haloitservices365

---

## Backup Locations

### Local Backups
```
/tmp/HaloIT-Platform-backup/      # ~98 MB clone of primary repo
/tmp/Haloitservices-backup/        # ~98 MB clone of backup repo
```

### Remote Backups
```
GitHub Primary:   github.com:replitcompiler-Dev321/HaloIT-Platform
GitHub Backup:    github.com:HaloAdmin365/Haloitservices365
```

### Source of Truth
```
/workspaces/JointHaloRepo/         # Main unified repository (ACTIVE)
Secrets-and-Keys/                  # SSH keys for authentication
```

---

## When & How to Use Backups

### Scenario 1: Unified Repo Corrupted

**Problem**: `/workspaces/JointHaloRepo` is broken or has merge conflicts

**Solution**:
```bash
# Restore from local backup
cd /workspaces
rm -rf JointHaloRepo
cp -r /tmp/HaloIT-Platform-backup JointHaloRepo

# Re-add the backup remote
cd JointHaloRepo
git remote add haloitservices git@github.com:HaloAdmin365/Haloitservices365.git

# Restore SSH keys
cp Secrets-and-Keys/haloit-platform-privatekey ~/.ssh/haloit-platform-key
cp Secrets-and-Keys/Haloitservices-privatekey ~/.ssh/haloitservices-key
chmod 600 ~/.ssh/*-key
```

**Time to recover**: < 2 minutes

---

### Scenario 2: GitHub Repo Compromised

**Problem**: Primary repo has malicious commits or was hacked

**Solution**:
```bash
# Step 1: Verify clean backup is in place
cd /tmp/HaloIT-Platform-backup
git log --oneline | head -5

# Step 2: Force push clean version from backup
git push origin main --force-with-lease

# Step 3: Verify on GitHub
# Check: github.com/replitcompiler-Dev321/HaloIT-Platform/commits/main

# Step 4: Update local repo
cd /workspaces/JointHaloRepo
git fetch origin
git reset --hard origin/main
```

**Security Note**: Only use `--force-with-lease` after verifying the backup is clean

---

### Scenario 3: Accidental Commits to Public Branch

**Problem**: Sensitive data accidentally committed to `main`

**Solution**:
```bash
# Step 1: Check what was committed
git log -1 --stat

# Step 2: Revert to previous clean state
# Option A: Revert the commit
git revert HEAD --no-edit
git push origin main

# Option B: Hard reset to previous commit (if urgent)
git reset --hard HEAD~1
git push origin main --force-with-lease

# Step 3: Clean history
# Remove from GitHub's cache:
git push origin +HEAD^:refs/heads/main

# Step 4: Verify fix
git log --oneline | head -5
```

**Important**: After any forced push, alert the team immediately

---

### Scenario 4: Lost Local Changes

**Problem**: Accidentally deleted files or lost uncommitted work

**Solution**:
```bash
# Step 1: Check git reflog for all actions
git reflog | head -20

# Step 2: Restore to previous state
git reset --hard <commit-hash>

# Or restore from remote
git fetch origin
git reset --hard origin/main

# Step 3: If already pushed, restore from backup
# Check backup repo for the commit
cd /tmp/HaloIT-Platform-backup
git log --oneline | grep "description of lost work"

# Step 4: Cherry-pick or reapply changes
cd /workspaces/JointHaloRepo
git cherry-pick <commit-hash>
```

---

### Scenario 5: SSH Key Compromised

**Problem**: Private SSH key is exposed or stolen

**Solution**:
```bash
# Step 1: Revoke old keys immediately on GitHub
# Go to: Settings > Deploy keys > Delete the compromised key

# Step 2: Generate new keys
ssh-keygen -t rsa -b 4096 -f /tmp/new-key -N ""

# Step 3: Add new public key to GitHub
cat /tmp/new-key.pub | xclip -selection clipboard
# Paste at: github.com/replitcompiler-Dev321/HaloIT-Platform/settings/keys

# Step 4: Update local SSH keys
cp /tmp/new-key ~/.ssh/haloit-platform-key
chmod 600 ~/.ssh/haloit-platform-key

# Step 5: Update SSH config
# Edit ~/.ssh/config with new key path

# Step 6: Test connectivity
ssh -i ~/.ssh/haloit-platform-key git@github.com

# Step 7: Update backup in repo
cp ~/.ssh/haloit-platform-key /workspaces/JointHaloRepo/Secrets-and-Keys/haloit-platform-privatekey

# Step 8: Force update both remotes
git push origin main --force-with-lease
git push haloitservices main --force-with-lease
```

---

## Backup Maintenance Schedule

### Daily
- ✓ Code changes committed to unified repo
- ✓ Auto-pushed to both GitHub remotes
- ✓ Deployed to Railway automatically

### Weekly
- [ ] Verify both GitHub repos are in sync
  ```bash
  cd /tmp/HaloIT-Platform-backup && git fetch origin
  cd /tmp/Haloitservices-backup && git fetch origin
  ```
- [ ] Check commit history matches
  ```bash
  cd /tmp/HaloIT-Platform-backup && git log --oneline | head -20
  cd /tmp/Haloitservices-backup && git log --oneline | head -20
  ```

### Monthly
- [ ] Refresh local backup copies
  ```bash
  rm -rf /tmp/HaloIT-Platform-backup /tmp/Haloitservices-backup
  cd /tmp
  git clone git@github.com:replitcompiler-Dev321/HaloIT-Platform.git HaloIT-Platform-backup
  git clone git@github.com:HaloAdmin365/Haloitservices365.git Haloitservices-backup
  ```
- [ ] Audit SSH keys are still secure
- [ ] Review GitHub access logs

### Quarterly
- [ ] Rotate SSH keys (generate new, update GitHub, destroy old)
- [ ] Full system security audit
- [ ] Update deployment targets if needed
- [ ] Review branch protection rules

---

## Recovery Checklist

### After Using a Backup (Any Scenario)

- [ ] Verify commit history matches expectations
  ```bash
  git log --oneline | head -20
  ```
- [ ] Check that all files are present
  ```bash
  find . -type f -name "*.js" | wc -l
  find . -type f -name "*.html" | wc -l
  ```
- [ ] Test deployment to Railway
  ```bash
  git push origin main
  # Check railway logs for successful build
  ```
- [ ] Verify admin console is accessible
  ```bash
  curl http://your-railway-url/api/admin/health
  ```
- [ ] Run any automated tests (if configured)
- [ ] Alert team of recovery action

---

## Backup Storage Locations Summary

| Backup Type | Location | Size | Last Updated | Purpose |
|---|---|---|---|---|
| Local Full Clone | `/tmp/HaloIT-Platform-backup/` | ~98 MB | Jun 10 20:53 | Quick local restore |
| Local Full Clone | `/tmp/Haloitservices-backup/` | ~98 MB | Jun 10 20:53 | Secondary restore |
| Active Unified | `/workspaces/JointHaloRepo/` | ~98 MB | Jun 10 20:54 | Primary work directory |
| SSH Keys | `/workspaces/JointHaloRepo/Secrets-and-Keys/` | ~3 KB | Jun 10 20:44 | GitHub authentication |
| GitHub Remote 1 | `github.com:replitcompiler-Dev321/HaloIT-Platform` | ~98 MB | Jun 10 20:54 | Primary remote |
| GitHub Remote 2 | `github.com:HaloAdmin365/Haloitservices365` | ~98 MB | Jun 10 20:53 | Backup remote |

---

## Important Notes

### Retention Policies
- **Local backups**: Keep indefinitely (disk space permitting)
- **GitHub remotes**: Keep both (GitHub provides redundancy)
- **SSH keys**: Rotate quarterly; archive old keys for 1 year

### Automatic Backup Strategy
Current setup provides:
- ✅ 2 GitHub remote backups (automatic with dual-push)
- ✅ 2 Local backup clones (updated monthly)
- ✅ Encrypted backup option (in `secure.enc` if configured)

### Disaster Recovery RTO/RPO
- **RTO** (Recovery Time Objective): < 5 minutes (from backup restore)
- **RPO** (Recovery Point Objective): < 1 hour (with hourly scheduled backups)

---

## Testing Backup Recovery

### Recommended: Run Monthly Drill

```bash
# 1. Create temporary test directory
mkdir /tmp/backup-test
cd /tmp/backup-test

# 2. Restore from backup
cp -r /tmp/HaloIT-Platform-backup ./test-repo
cd test-repo

# 3. Verify integrity
git log --oneline | wc -l          # Count commits
find . -type f | wc -l             # Count files
du -sh .                            # Check size

# 4. Test connectivity
git remote -v
git fetch origin

# 5. Verify key files exist
test -f backend/server.js && echo "✓ Backend exists"
test -f frontend/index.html && echo "✓ Frontend exists" || echo "Frontend varies"
test -f .chat_history.md && echo "✓ Chat history exists"

# 6. Clean up
cd /
rm -rf /tmp/backup-test
```

Expected output:
```
✓ 10+ commits verified
✓ 1000+ files verified
✓ ~98 MB size verified
✓ Backend exists
✓ Chat history exists
```

---

## Documentation Links

- `UNIFIED_REPO_SETUP.md` - Main setup guide
- `GITHUB_SECURITY_SETUP.md` - Security lockdown steps
- `PROJECT_STATUS_SUMMARY.md` - Project overview
- `README.md` - Project documentation
- `.chat_history.md` - Development notes

---

*Last Updated: 2026-06-10*
*Backup Status: Active (2 local + 2 GitHub remotes)*
*Automatic Dual-Push: Enabled*
*Recovery Tested: Pending (run monthly drill)*

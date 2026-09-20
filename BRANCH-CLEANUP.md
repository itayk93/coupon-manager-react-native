# Branch cleanup

These branches were checked with `git branch -r --merged origin/claude/mascot-source-art` and are already merged into `claude/mascot-source-art`.

Keep:

- `main`
- `claude/mascot-source-art`
- branches not listed as merged
- Dependabot branches

Delete these merged branches when using a GitHub-authenticated shell:

```bash
git push origin --delete \
  claude/coupon-manager-react-native-fk5rnz \
  claude/home-page-admin-debug-u40th8 \
  claude/instagram-reel-analysis-mxtdng \
  claude/kuponi-escalation-atlas \
  claude/kuponi-integration \
  claude/kuponi-stories \
  claude/mascot-forward-loops \
  claude/poni-kuponi-character-zls79j \
  claude/single-animation-expiring-text-6n5l4q
```

Do not delete `claude/mascot-source-art`; it is the active artwork branch.

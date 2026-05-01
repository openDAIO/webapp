# Reviewer Character Assets

Canonical reviewer sprites live in this folder with numeric IDs:

- `ai-01.png` through `ai-09.png` are the shared reviewer character images.
- `states/` contains optional state animations such as reward or penalty GIFs.
- `ai-06.png`, `ai-07.png`, `ai-08.png`, and `ai-09.png` are shared assets. Reuse these same files from multiple labs instead of duplicating them in room-specific folders.

When adding a new reviewer image, keep the filename format as `ai-00.png` with a two-digit number.

Use these names in `states/` for result motion:

- `ai-00-reward.gif` for rewarded/winning motion.
- `ai-00-penalty.gif` for slashed motion.

The app also accepts uppercase `.GIF` extensions and matches these state files automatically by character ID.

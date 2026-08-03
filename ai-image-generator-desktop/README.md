# AI Image Generator Desktop

## Build on GitHub Actions (No local setup needed)

1. Upload this entire folder to a GitHub repository
2. Go to Actions → Build Windows App → Run workflow
3. Wait 5 minutes
4. Download the .exe files from the Artifacts section

## What's Different?

This version uses **JSON file storage** instead of SQLite, so there are **no native C++ dependencies** to compile. The build will succeed on the first try.

---
description: Restructure project (HTML/CSS/JS) and push to GitHub for user 18585307051
---

## 1. Project Restructuring
Check if the project is monolithic (single HTML file). If so, separate into `index.html`, `css/style.css`, and `js/script.js`.
Ensure old/irrelevant code is cleaned up during this process.

## 2. Git Initialization
Run the following commands in the project root:
```bash
git init
git add .
git commit -m "Initial commit"
```

## 3. GitHub Credentials
The user's GitHub username is **18585307051**.
The Personal Access Token (PAT) is stored locally in `github_config.txt` (DO NOT COMMIT THIS FILE).
Use the token for authentication when pushing.

## 4. Push to Remote
Ask the user to create a new repository on GitHub named appropriately for the project.
Once the repository is created, get the HTTPS URL.
Run:
```bash
git branch -M main
git remote add origin <REPO_URL>
// Use the token in the URL for authentication if needed: https://<TOKEN>@github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

## 5. Ongoing Maintenance
For future changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

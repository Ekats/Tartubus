# Useful Commands for Tartu Bussid

Quick reference for common development and deployment tasks.

## 🚀 Development

### Start development server
```bash
npm run dev
```
- Opens at `http://localhost:5173` (or 5174/5175 if port is busy)
- Hot module replacement (HMR) enabled
- Auto-refreshes on code changes

### Build for production
```bash
npm run build
```
- Builds optimized production files to `dist/`
- Runs `prebuild` script first (fetches route data)
- Minifies code, optimizes assets

### Preview production build
```bash
npm run preview
```
- Serves the built `dist/` folder locally
- Tests production build before deployment

## 📊 Data Management

### Fetch latest bus route data
```bash
npm run fetch-routes
```
- Downloads route geometry from Digitransit API
- Saves to `public/data/routes.json` (150MB, gitignored)
- Creates `public/data/routes.min.json` (smaller, committed to git)
- Runs automatically before each build

## 🌐 Deployment

### Deploy to GitHub Pages
```bash
npm run deploy
```
- Builds the app
- Pushes to `gh-pages` branch
- Live at: https://ekats.github.io/Tartubus

### Manual deployment steps
```bash
npm run build
git add dist -f
git commit -m "Build for deployment"
git subtree push --prefix dist origin gh-pages
```

## 📱 Android (Capacitor)

### Build and open in Android Studio
```bash
npm run android:build
```
- Builds web app
- Syncs to Android project
- Opens Android Studio
- Use this when starting Android development

### Sync changes to Android (faster)
```bash
npm run android:sync
```
- Copies web build to Android project
- Use this after making web code changes
- Faster than full rebuild

### Open Android Studio
```bash
npm run android:open
```
- Just opens Android Studio
- Use when you only need to work in Android Studio

### Build APK from command line
```bash
npm run android:apk
```
- Builds web app
- Syncs to Android
- Runs Gradle build
- Requires Android SDK and Gradle setup
- APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## 🔧 Git Operations

### Check what's changed
```bash
git status
git diff
```

### Commit changes
```bash
git add .
git commit -m "Your commit message"
git push
```

### Create new branch
```bash
git checkout -b feature-name
```

### Switch branches
```bash
git checkout main
git checkout feature-name
```

### Update from remote
```bash
git pull origin main
```

### View commit history
```bash
git log --oneline
git log --graph --oneline --all
```

## 🧹 Maintenance

### Install dependencies
```bash
npm install
```

### Update dependencies
```bash
npm update
npm outdated  # Check for outdated packages
```

### Fix security vulnerabilities
```bash
npm audit
npm audit fix
```

### Clean and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### Clean Capacitor/Android
```bash
rm -rf android/
npx cap add android
npm run android:sync
```

## 🐛 Debugging

### Check for linting errors
```bash
npx eslint src/
```

### View dev server output
The dev server shows errors and warnings in the terminal.

### Check browser console
Open DevTools (F12) in browser to see:
- JavaScript errors
- Network requests
- Console logs

### Test on different browsers
```bash
# Chrome
npm run dev
# Visit http://localhost:5173

# Firefox
# Visit http://localhost:5173 in Firefox

# Edge
# Visit http://localhost:5173 in Edge
```

## 📦 Package Management

### Add new dependency
```bash
npm install package-name
npm install --save-dev package-name  # Dev dependency
```

### Remove dependency
```bash
npm uninstall package-name
```

### View installed packages
```bash
npm list
npm list --depth=0  # Top level only
```

## 🌍 Translation Management

### Translation files location
```
src/locales/
├── en.json  # English
├── et.json  # Estonian
└── uk.json  # Ukrainian
```

### Test different languages
1. Run `npm run dev`
2. Open Settings tab
3. Change language
4. Verify translations appear correctly

## 🗺️ API Testing

### Test Digitransit API directly
```bash
# Using curl
curl -X POST https://api.digitransit.fi/routing/v1/routers/waltti/index/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ stops(name:\"Tartu\") { name gtfsId } }"}'

# Using browser
# Visit: https://api.digitransit.fi/graphiql/waltti
# Paste query and run
```

## 🔍 Search in Code

### Find text in files
```bash
# Windows
findstr /s /i "search term" *.js *.jsx

# Git bash / Linux / Mac
grep -r "search term" src/
```

### Find files by name
```bash
# Windows
dir /s /b *filename*

# Git bash / Linux / Mac
find . -name "*filename*"
```

## 📝 Version Management

### Update version number
Edit these files:
1. `package.json` - line 4
2. `src/components/Settings.jsx` - line 290
3. `instructions.md` - line 3
4. `CHANGELOG.md` - add new entry

### Tag a release
```bash
git tag -a v1.3.1 -m "Version 1.3.1"
git push origin v1.3.1
```

## 🚦 GitHub Actions

### Manually trigger workflows
1. Go to: https://github.com/ekats/Tartubus/actions
2. Select workflow
3. Click "Run workflow"

### View workflow logs
1. Go to Actions tab
2. Click on specific run
3. Click on job to see logs

### Available workflows
- **deploy.yml** - Deploys to GitHub Pages (manual trigger)
- **update-routes.yml** - Updates route data nightly at 3 AM UTC

## 💡 Quick Tips

### Run multiple commands in sequence
```bash
npm run build && npm run deploy
```

### Run commands in background (Windows)
```bash
start npm run dev
```

### Kill process on port (if port is busy)
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5173 | xargs kill
```

### Open project in VS Code
```bash
code .
```

### Open Android Studio project
```bash
npm run android:open
# Or manually:
# Open Android Studio → Open → Select android/ folder
```

## 📚 Documentation Links

- **Vite**: https://vitejs.dev/
- **React**: https://react.dev/
- **Leaflet**: https://leafletjs.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **i18next**: https://www.i18next.com/
- **Digitransit API**: https://digitransit.fi/en/developers/
- **Capacitor**: https://capacitorjs.com/docs

---

**Pro tip:** Bookmark this file! Add it to your VS Code favorites or browser bookmarks.

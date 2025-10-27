[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner2-direct.svg)](https://vshymanskyy.github.io/StandWithUkraine/)

# Tartu Bussid - Live Bus Tracker

A privacy-focused, modern live bus tracking app for Tartu, Estonia. Built to be faster and more intuitive than peatus.ee.

## Features

- 🚌 **Live bus tracking** - See all buses moving in real-time on the map
- 📍 **Your location** - Quickly find buses near you
- 🗺️ **OpenStreetMap** - Privacy-friendly maps with no tracking
- ⚡ **Fast & lightweight** - Built with modern React + Vite
- 📱 **Mobile-first** - Optimized for use on the go

## Quick Start

### 1. Get a Digitransit API Key

1. Register at https://portal-api.digitransit.fi/
2. Sign up with your email
3. Subscribe to the API under "Products" tab
4. Copy your API key (`digitransit-subscription-key`)

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your API key:

```
VITE_DIGITRANSIT_API_KEY=your_api_key_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The production files will be in the `dist/` folder, ready to deploy to Vercel, Netlify, or GitHub Pages.

## Tech Stack

- **React 18** - Modern UI framework
- **Vite** - Lightning-fast build tool
- **Leaflet** - Interactive maps
- **Tailwind CSS** - Utility-first styling
- **Digitransit API** - Real-time bus data
- **OpenStreetMap** - Free, privacy-friendly map tiles

## Project Structure

```
src/
├── components/          # React components
│   ├── BusMap.jsx      # Main map view
│   ├── BusMarker.jsx   # Individual bus markers
│   └── Header.jsx      # App header
├── hooks/              # Custom React hooks
│   ├── useBusLocations.js
│   └── useGeolocation.js
├── services/           # API clients
│   └── digitransit.js
├── utils/              # Helper functions
│   └── timeFormatter.js
├── App.jsx            # Main app component
├── main.jsx           # Entry point
└── index.css          # Global styles
```

## Contributing

This is an open-source project. Feel free to submit issues or pull requests!

## License

MIT License - see LICENSE file for details

## Privacy

- ✅ No user tracking
- ✅ No analytics
- ✅ No ads
- ✅ All data from public Digitransit API
- ✅ OpenStreetMap tiles (no Google tracking)

---

**Built with ❤️ for Tartu** 🇪🇪

*Route colors (blue & yellow) chosen in solidarity with Ukraine* 🇺🇦

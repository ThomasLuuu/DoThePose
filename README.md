# Pose Guide App

A mobile application that converts reference images into low-opacity line-drawing pose guides. Upload a photo with the pose you want to recreate, and the app will extract the body pose, horizon line, sun position, and key composition elements as transparent overlays.

## Features

- Upload images from gallery or camera
- Automatic background removal
- Human pose skeleton extraction
- Composition element detection (horizon, sun, rule of thirds)
- Adjustable opacity overlay for pose matching
- Save and manage pose guides library
- Favorite guides for quick access

## Project Structure

```
camera/
├── mobile-rn/        # Expo / React Native mobile app
│   ├── src/
│   ├── App.tsx
│   ├── app.json
│   └── package.json
│
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Image processing pipeline
│   │   ├── repositories/ # Data persistence
│   │   ├── models/       # Type definitions
│   │   └── middleware/   # Error handling
│   └── package.json
│
└── README.md
```

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`.

### Mobile App Setup (Expo)

1. Ensure Node.js 20+ is installed.

2. Navigate to the mobile directory:
   ```bash
   cd mobile-rn
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Update the API base URL in `src/` (see `src/config` or the API client module) to point to your backend.

5. Start the Expo dev server:
   ```bash
   npm run start        # opens Expo dev tools
   npm run ios          # iOS simulator
   npm run android      # Android emulator
   npm run web          # web preview
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/guides` | Upload image and create pose guide |
| GET | `/api/guides` | List all saved guides |
| GET | `/api/guides/:id` | Get guide details |
| PATCH | `/api/guides/:id` | Update guide (favorite, tags) |
| DELETE | `/api/guides/:id` | Delete a guide |
| GET | `/health` | Health check |

## Image Processing Pipeline

1. **Background Removal**: Segments the foreground subject from the background
2. **Pose Extraction**: Detects human body keypoints and skeleton
3. **Composition Analysis**: Identifies horizon lines, sun/bright spots, and salient edges
4. **Line Rendering**: Combines all elements into a transparent PNG with configurable opacity

## Tech Stack

### Mobile (mobile-rn/)
- Expo ~54 / React Native 0.81
- React Navigation (bottom tabs + native stack)
- TanStack Query (server state)
- Zustand (client state)
- Axios (HTTP client)
- expo-image-picker, expo-file-system

### Backend
- Node.js 20+
- Express
- Sharp (image processing)
- better-sqlite3 (database)
- Multer (file uploads)

## Configuration

### Guide Settings

| Setting | Default | Description |
|---------|---------|-------------|
| strokeWidth | 2 | Line thickness in pixels |
| opacity | 0.4 | Guide overlay opacity (0.1 - 1.0) |
| simplificationLevel | 1 | Line simplification (1-3) |

## License

MIT

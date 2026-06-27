# Glass Music 🎵

A beautiful Android music streaming app with **iOS 28-inspired Glassmorphism UI**, powered by YouTube via NewPipe Extractor. No API keys needed!

## ✨ Features

- **Glassmorphism UI** - iOS 28 style frosted glass design
- **YouTube Music Streaming** - Via NewPipe Extractor (no API key)
- **Search** - Find any song on YouTube
- **Trending & Recommended** - Auto-curated music
- **Full Player** - Album art, progress, shuffle, repeat
- **Lyrics Support** - Real-time lyrics display
- **Background Playback** - Media session service
- **Queue Management** - Add to queue, skip tracks
- **Mini Player** - Persistent bottom controls
- **Lock Screen Controls** - Media button support

## 🏗 Architecture

```
com.spotify.glassmusic/
├── data/
│   ├── model/          # Song, Playlist, Artist, LyricsLine
│   └── repository/     # MusicRepository (NewPipe)
├── player/
│   └── MusicPlayerManager.kt  # ExoPlayer wrapper
├── service/
│   └── MusicPlaybackService.kt # Foreground media service
├── receiver/
│   └── MediaButtonReceiver.kt  # Headset controls
├── ui/
│   ├── MainActivity.kt
│   ├── PlayerActivity.kt
│   ├── SearchActivity.kt
│   ├── PlaylistActivity.kt
│   ├── adapter/        # RecyclerView adapters
│   └── viewmodel/      # MVVM ViewModels
└── GlassMusicApp.kt    # Application class
```

## 🚀 GitHub Actions Build

The `.github/workflows/build.yml` automatically builds APK on every push:

1. Push code to `main` branch
2. GitHub Actions builds both Debug & Release APK
3. Download APK from Actions artifacts

### Manual Build
```bash
./gradlew assembleDebug
```

## 📦 Package Name
```
com.spotify.glassmusic
```

## 🔧 Tech Stack

- **Kotlin** - Primary language
- **ExoPlayer (Media3)** - Audio playback
- **NewPipe Extractor** - YouTube data extraction
- **Glide** - Image loading with blur
- **Coroutines** - Async operations
- **MVVM** - Architecture pattern
- **Material3** - UI components

## 📝 Notes

- NewPipe Extractor fetches YouTube streams without API keys
- For production, consider adding signature verification
- Lyrics fetched from Genius (fallback to placeholder)
- Background playback requires FOREGROUND_SERVICE permission

## ⚠️ Disclaimer

This app is for educational purposes. Respect YouTube's Terms of Service.

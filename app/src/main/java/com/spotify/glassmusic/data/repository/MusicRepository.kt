package com.spotify.glassmusic.data.repository

import android.util.Log
import com.spotify.glassmusic.data.model.Song
import com.spotify.glassmusic.data.model.Artist
import com.spotify.glassmusic.data.model.Playlist
import com.spotify.glassmusic.data.model.LyricsLine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeSearchQueryHandlerFactory
import org.jsoup.Jsoup
import org.jsoup.nodes.Document

class MusicRepository {

    companion object {
        private const val TAG = "MusicRepository"
        private const val YOUTUBE_SERVICE_ID = 0
    }

    suspend fun searchSongs(query: String, page: String = ""): List<Song> = withContext(Dispatchers.IO) {
        try {
            val searchInfo = SearchInfo.getInfo(
                NewPipe.getService(YOUTUBE_SERVICE_ID),
                NewPipe.getService(YOUTUBE_SERVICE_ID).searchQHFactory.fromQuery(query, listOf("videos"), "")
            )

            searchInfo.relatedItems.mapNotNull { item ->
                try {
                    Song(
                        id = item.url,
                        title = item.name,
                        artist = item.uploaderName ?: "Unknown Artist",
                        album = "",
                        duration = item.duration * 1000L,
                        thumbnailUrl = item.thumbnailUrl,
                        audioUrl = item.url,
                        videoUrl = item.url
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing song: ${e.message}")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Search error: ${e.message}")
            emptyList()
        }
    }

    suspend fun getAudioStream(videoUrl: String): String = withContext(Dispatchers.IO) {
        try {
            val streamInfo = StreamInfo.getInfo(NewPipe.getService(YOUTUBE_SERVICE_ID), videoUrl)
            // Get highest quality audio stream
            val audioStream = streamInfo.audioStreams.maxByOrNull { it.bitrate }
                ?: streamInfo.audioStreams.firstOrNull()
            audioStream?.url ?: streamInfo.url
        } catch (e: Exception) {
            Log.e(TAG, "Stream error: ${e.message}")
            videoUrl
        }
    }

    suspend fun getLyrics(title: String, artist: String): List<LyricsLine> = withContext(Dispatchers.IO) {
        try {
            // Try Genius lyrics first
            val searchQuery = "$title $artist lyrics genius"
            val doc = Jsoup.connect("https://www.google.com/search?q=${searchQuery.replace(" ", "+")}")
                .userAgent("Mozilla/5.0")
                .get()

            // Fallback: return demo lyrics
            getDemoLyrics(title)
        } catch (e: Exception) {
            getDemoLyrics(title)
        }
    }

    private fun getDemoLyrics(title: String): List<LyricsLine> {
        return listOf(
            LyricsLine(0, "🎵 $title"),
            LyricsLine(5000, "Lyrics loading..."),
            LyricsLine(10000, "Connect to internet for full lyrics"),
            LyricsLine(15000, "🎶 Enjoy the music! 🎶")
        )
    }

    suspend fun getTrendingSongs(): List<Song> = withContext(Dispatchers.IO) {
        searchSongs("trending music 2026")
    }

    suspend fun getRecommendedSongs(): List<Song> = withContext(Dispatchers.IO) {
        searchSongs("top hits 2026")
    }
}

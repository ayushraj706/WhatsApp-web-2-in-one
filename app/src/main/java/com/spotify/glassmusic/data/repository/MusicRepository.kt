package com.spotify.glassmusic.data.repository

import android.util.Log
import com.spotify.glassmusic.data.model.LyricsLine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.jsoup.Jsoup

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
                val streamItem = item as? StreamInfoItem ?: return@mapNotNull null
                
                try {
                    Song(
                        id = streamItem.url,
                        title = streamItem.name,
                        artist = streamItem.uploaderName ?: "Unknown Artist",
                        album = "",
                        duration = streamItem.duration * 1000L,
                        // 🔥 FIX: Thumbnail access updated for new library version 🔥
                        thumbnailUrl = streamItem.thumbnails.firstOrNull()?.url ?: "", 
                        audioUrl = streamItem.url,
                        videoUrl = streamItem.url
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

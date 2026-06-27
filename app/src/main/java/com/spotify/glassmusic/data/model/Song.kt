package com.spotify.glassmusic.data.model

data class Song(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Long,
    val thumbnailUrl: String,
    val audioUrl: String,
    val videoUrl: String,
    val lyrics: String = "",
    val isFavorite: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

data class Playlist(
    val id: String,
    val name: String,
    val coverUrl: String,
    val songs: MutableList<Song> = mutableListOf(),
    val createdAt: Long = System.currentTimeMillis()
)

data class SearchResult(
    val songs: List<Song>,
    val playlists: List<Playlist>,
    val artists: List<Artist>
)

data class Artist(
    val id: String,
    val name: String,
    val avatarUrl: String,
    val subscribers: String
)

data class LyricsLine(
    val timeMs: Long,
    val text: String
)

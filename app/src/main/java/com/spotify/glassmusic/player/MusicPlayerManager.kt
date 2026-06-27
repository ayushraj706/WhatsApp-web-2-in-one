package com.spotify.glassmusic.player

import android.content.Context
import android.net.Uri
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.datasource.DefaultHttpDataSource
import com.spotify.glassmusic.data.repository.MusicRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@UnstableApi
class MusicPlayerManager private constructor(context: Context) {

    private val repository = MusicRepository()
    private val exoPlayer: ExoPlayer

    private val _currentSong = MutableLiveData<Song?>()
    val currentSong: LiveData<Song?> = _currentSong

    private val _isPlaying = MutableLiveData(false)
    val isPlaying: LiveData<Boolean> = _isPlaying

    private val _currentPosition = MutableLiveData(0L)
    val currentPosition: LiveData<Long> = _currentPosition

    private val _duration = MutableLiveData(0L)
    val duration: LiveData<Long> = _duration

    private val _queue = MutableLiveData<List<Song>>(emptyList())
    val queue: LiveData<List<Song>> = _queue

    private val _currentIndex = MutableLiveData(0)
    val currentIndex: LiveData<Int> = _currentIndex

    private val _isShuffle = MutableLiveData(false)
    val isShuffle: LiveData<Boolean> = _isShuffle

    private val _repeatMode = MutableLiveData(Player.REPEAT_MODE_OFF)
    val repeatMode: LiveData<Int> = _repeatMode

    private var updatePositionJob: kotlinx.coroutines.Job? = null

    companion object {
        @Volatile
        private var instance: MusicPlayerManager? = null

        fun getInstance(context: Context): MusicPlayerManager {
            return instance ?: synchronized(this) {
                instance ?: MusicPlayerManager(context.applicationContext).also { instance = it }
            }
        }
    }

    init {
        val dataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .setAllowCrossProtocolRedirects(true)

        exoPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory))
            .build()

        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    _duration.value = exoPlayer.duration
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
                if (isPlaying) startPositionUpdates()
                else stopPositionUpdates()
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val index = exoPlayer.currentMediaItemIndex
                _currentIndex.value = index
                _queue.value?.getOrNull(index)?.let { _currentSong.value = it }
            }
        })
    }

    fun playSong(song: Song, queue: List<Song> = listOf(song)) {
        CoroutineScope(Dispatchers.Main).launch {
            _queue.value = queue
            val index = queue.indexOfFirst { it.id == song.id }.coerceAtLeast(0)
            _currentIndex.value = index
            _currentSong.value = song

            val audioUrl = withContext(Dispatchers.IO) {
                repository.getAudioStream(song.videoUrl)
            }

            val mediaItems = queue.map { 
                MediaItem.fromUri(Uri.parse(audioUrl))
            }

            exoPlayer.setMediaItems(mediaItems, index, 0)
            exoPlayer.prepare()
            exoPlayer.play()
        }
    }

    fun playPause() {
        if (exoPlayer.isPlaying) exoPlayer.pause()
        else exoPlayer.play()
    }

    fun next() {
        if (exoPlayer.hasNextMediaItem()) exoPlayer.seekToNext()
    }

    fun previous() {
        if (exoPlayer.hasPreviousMediaItem()) exoPlayer.seekToPrevious()
    }

    fun seekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs)
    }

    fun toggleShuffle() {
        val newShuffle = !(_isShuffle.value ?: false)
        _isShuffle.value = newShuffle
        exoPlayer.shuffleModeEnabled = newShuffle
    }

    fun toggleRepeat() {
        val modes = listOf(Player.REPEAT_MODE_OFF, Player.REPEAT_MODE_ALL, Player.REPEAT_MODE_ONE)
        val current = _repeatMode.value ?: Player.REPEAT_MODE_OFF
        val next = modes[(modes.indexOf(current) + 1) % modes.size]
        _repeatMode.value = next
        exoPlayer.repeatMode = next
    }

    fun addToQueue(song: Song) {
        val currentQueue = _queue.value?.toMutableList() ?: mutableListOf()
        currentQueue.add(song)
        _queue.value = currentQueue
        exoPlayer.addMediaItem(MediaItem.fromUri(Uri.parse(song.audioUrl)))
    }

    private fun startPositionUpdates() {
        stopPositionUpdates()
        updatePositionJob = CoroutineScope(Dispatchers.Main).launch {
            while (true) {
                _currentPosition.value = exoPlayer.currentPosition
                kotlinx.coroutines.delay(500)
            }
        }
    }

    private fun stopPositionUpdates() {
        updatePositionJob?.cancel()
        updatePositionJob = null
    }

    fun release() {
        stopPositionUpdates()
        exoPlayer.release()
        instance = null
    }

    fun getExoPlayer(): ExoPlayer = exoPlayer
}

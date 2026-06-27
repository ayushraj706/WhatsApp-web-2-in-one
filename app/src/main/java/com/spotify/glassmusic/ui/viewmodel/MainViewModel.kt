package com.spotify.glassmusic.ui.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spotify.glassmusic.data.model.Playlist
import com.spotify.glassmusic.data.repository.MusicRepository
import kotlinx.coroutines.launch

class MainViewModel : ViewModel() {

    private val repository = MusicRepository()

    private val _trendingSongs = MutableLiveData<List<Song>>()
    val trendingSongs: LiveData<List<Song>> = _trendingSongs

    private val _recommendedSongs = MutableLiveData<List<Song>>()
    val recommendedSongs: LiveData<List<Song>> = _recommendedSongs

    private val _playlists = MutableLiveData<List<Playlist>>()
    val playlists: LiveData<List<Playlist>> = _playlists

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    fun loadTrendingSongs() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _trendingSongs.value = repository.getTrendingSongs()
            } catch (e: Exception) {
                _trendingSongs.value = emptyList()
            }
            _isLoading.value = false
        }
    }

    fun loadRecommendedSongs() {
        viewModelScope.launch {
            try {
                _recommendedSongs.value = repository.getRecommendedSongs()
            } catch (e: Exception) {
                _recommendedSongs.value = emptyList()
            }
        }
    }
}

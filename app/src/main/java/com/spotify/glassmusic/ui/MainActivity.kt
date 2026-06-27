package com.spotify.glassmusic.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import com.bumptech.glide.Glide
import jp.wasabeef.glide.transformations.BlurTransformation
import com.spotify.glassmusic.R
import com.spotify.glassmusic.databinding.ActivityMainBinding
import com.spotify.glassmusic.player.MusicPlayerManager
import com.spotify.glassmusic.data.model.Song // 🔥 FIX: Import added 🔥
import com.spotify.glassmusic.ui.adapter.SongAdapter
import com.spotify.glassmusic.ui.adapter.PlaylistAdapter
import com.spotify.glassmusic.ui.viewmodel.MainViewModel

@UnstableApi
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: MainViewModel by viewModels()
    private lateinit var playerManager: MusicPlayerManager
    private lateinit var trendingAdapter: SongAdapter
    private lateinit var recommendedAdapter: SongAdapter
    private lateinit var playlistAdapter: PlaylistAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge + transparent status bar for glass effect
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        playerManager = MusicPlayerManager.getInstance(this)

        setupEdgeToEdge()
        setupRecyclerViews()
        setupClickListeners()
        setupObservers()
        setupMiniPlayer()

        viewModel.loadTrendingSongs()
        viewModel.loadRecommendedSongs()
    }

    private fun setupEdgeToEdge() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            binding.statusBarBg.updatePadding(top = systemBars.top)
            binding.miniPlayerContainer.updatePadding(bottom = systemBars.bottom)
            insets
        }
    }

    private fun setupRecyclerViews() {
        trendingAdapter = SongAdapter { song ->
            playSong(song, viewModel.trendingSongs.value ?: emptyList())
        }
        binding.rvTrending.apply {
            layoutManager = LinearLayoutManager(this@MainActivity, LinearLayoutManager.HORIZONTAL, false)
            adapter = trendingAdapter
        }

        recommendedAdapter = SongAdapter { song ->
            playSong(song, viewModel.recommendedSongs.value ?: emptyList())
        }
        binding.rvRecommended.apply {
            layoutManager = LinearLayoutManager(this@MainActivity, LinearLayoutManager.HORIZONTAL, false)
            adapter = recommendedAdapter
        }

        playlistAdapter = PlaylistAdapter { playlist ->
            // Open playlist
        }
        binding.rvPlaylists.apply {
            layoutManager = LinearLayoutManager(this@MainActivity, LinearLayoutManager.HORIZONTAL, false)
            adapter = playlistAdapter
        }
    }

    private fun setupClickListeners() {
        binding.searchBar.setOnClickListener {
            startActivity(Intent(this, SearchActivity::class.java))
        }

        binding.btnPlayAll.setOnClickListener {
            viewModel.trendingSongs.value?.firstOrNull()?.let { song ->
                playSong(song, viewModel.trendingSongs.value ?: emptyList())
            }
        }

        binding.miniPlayerContainer.setOnClickListener {
            startActivity(Intent(this, PlayerActivity::class.java))
        }

        binding.btnMiniPlayPause.setOnClickListener {
            playerManager.playPause()
        }

        binding.btnMiniNext.setOnClickListener {
            playerManager.next()
        }
    }

    private fun setupObservers() {
        viewModel.trendingSongs.observe(this) { songs ->
            trendingAdapter.submitList(songs)
            if (songs.isNotEmpty()) {
                Glide.with(this)
                    .load(songs[0].thumbnailUrl)
                    .transform(BlurTransformation(25, 3))
                    .into(binding.bgImage)
            }
        }

        viewModel.recommendedSongs.observe(this) { songs ->
            recommendedAdapter.submitList(songs)
        }

        viewModel.isLoading.observe(this) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }
    }

    private fun setupMiniPlayer() {
        playerManager.currentSong.observe(this) { song ->
            if (song != null) {
                binding.miniPlayerContainer.visibility = View.VISIBLE
                binding.tvMiniTitle.text = song.title
                binding.tvMiniArtist.text = song.artist
                Glide.with(this)
                    .load(song.thumbnailUrl)
                    .placeholder(R.drawable.ic_music_note)
                    .into(binding.ivMiniThumbnail)
            } else {
                binding.miniPlayerContainer.visibility = View.GONE
            }
        }

        playerManager.isPlaying.observe(this) { isPlaying ->
            binding.btnMiniPlayPause.setImageResource(
                if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
            )
        }
    }

    private fun playSong(song: Song, queue: List<Song>) {
        playerManager.playSong(song, queue)
        binding.miniPlayerContainer.visibility = View.VISIBLE
    }

    override fun onResume() {
        super.onResume()
        playerManager.currentSong.value?.let {
            binding.miniPlayerContainer.visibility = View.VISIBLE
        }
    }
}

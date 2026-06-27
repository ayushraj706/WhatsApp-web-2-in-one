package com.spotify.glassmusic.ui

import android.animation.ValueAnimator
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.SeekBar
import androidx.appcompat.app.AppCompatActivity
import androidx.core.animation.doOnEnd
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.BlurTransformation
import com.spotify.glassmusic.R
import com.spotify.glassmusic.databinding.ActivityPlayerBinding
import com.spotify.glassmusic.player.MusicPlayerManager
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

@UnstableApi
class PlayerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPlayerBinding
    private lateinit var playerManager: MusicPlayerManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Full immersive mode
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        playerManager = MusicPlayerManager.getInstance(this)

        setupGlassBackground()
        setupControls()
        setupObservers()
        setupLyrics()
    }

    private fun setupGlassBackground() {
        // Apply heavy blur to background for glass effect
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            binding.bgBlur.setRenderEffect(
                RenderEffect.createBlurEffect(80f, 80f, Shader.TileMode.CLAMP)
            )
        }
    }

    private fun setupControls() {
        // Back button
        binding.btnBack.setOnClickListener { finish() }

        // Play/Pause
        binding.btnPlayPause.setOnClickListener {
            playerManager.playPause()
        }

        // Previous
        binding.btnPrevious.setOnClickListener {
            playerManager.previous()
            animateButton(binding.btnPrevious)
        }

        // Next
        binding.btnNext.setOnClickListener {
            playerManager.next()
            animateButton(binding.btnNext)
        }

        // Shuffle
        binding.btnShuffle.setOnClickListener {
            playerManager.toggleShuffle()
        }

        // Repeat
        binding.btnRepeat.setOnClickListener {
            playerManager.toggleRepeat()
        }

        // SeekBar
        binding.seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    binding.tvCurrentTime.text = formatTime(progress.toLong())
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}

            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                seekBar?.let {
                    playerManager.seekTo(it.progress.toLong())
                }
            }
        })

        // Queue button
        binding.btnQueue.setOnClickListener {
            // Show queue bottom sheet
        }

        // Lyrics button
        binding.btnLyrics.setOnClickListener {
            toggleLyrics()
        }

        // Favorite
        binding.btnFavorite.setOnClickListener {
            animateButton(binding.btnFavorite)
            // Toggle favorite
        }
    }

    private fun setupObservers() {
        playerManager.currentSong.observe(this) { song ->
            song?.let {
                binding.tvTitle.text = it.title
                binding.tvArtist.text = it.artist
                binding.tvAlbum.text = it.album.ifEmpty { "Single" }

                // Load thumbnail with blur for background
                Glide.with(this)
                    .load(it.thumbnailUrl)
                    .transform(BlurTransformation(50, 3))
                    .into(binding.bgBlur)

                // Load clear thumbnail for album art
                Glide.with(this)
                    .load(it.thumbnailUrl)
                    .placeholder(R.drawable.ic_album_art)
                    .into(binding.ivAlbumArt)

                binding.seekBar.max = it.duration.toInt()
                binding.tvTotalTime.text = formatTime(it.duration)
            }
        }

        playerManager.isPlaying.observe(this) { isPlaying ->
            binding.btnPlayPause.setImageResource(
                if (isPlaying) R.drawable.ic_pause_circle else R.drawable.ic_play_circle
            )
            // Rotate album art when playing
            if (isPlaying) {
                startAlbumArtRotation()
            } else {
                stopAlbumArtRotation()
            }
        }

        playerManager.currentPosition.observe(this) { position ->
            binding.seekBar.progress = position.toInt()
            binding.tvCurrentTime.text = formatTime(position)
        }

        playerManager.duration.observe(this) { duration ->
            if (duration > 0) {
                binding.seekBar.max = duration.toInt()
                binding.tvTotalTime.text = formatTime(duration)
            }
        }

        playerManager.isShuffle.observe(this) { isShuffle ->
            binding.btnShuffle.alpha = if (isShuffle) 1.0f else 0.5f
        }

        playerManager.repeatMode.observe(this) { mode ->
            when (mode) {
                Player.REPEAT_MODE_OFF -> binding.btnRepeat.setImageResource(R.drawable.ic_repeat)
                Player.REPEAT_MODE_ALL -> binding.btnRepeat.setImageResource(R.drawable.ic_repeat_on)
                Player.REPEAT_MODE_ONE -> binding.btnRepeat.setImageResource(R.drawable.ic_repeat_one)
            }
        }
    }

    private fun setupLyrics() {
        // Lyrics will be loaded when song changes
    }

    private fun toggleLyrics() {
        val targetAlpha = if (binding.lyricsContainer.visibility == View.VISIBLE) 0f else 1f
        val targetVisibility = if (binding.lyricsContainer.visibility == View.VISIBLE) View.GONE else View.VISIBLE

        binding.lyricsContainer.animate()
            .alpha(targetAlpha)
            .setDuration(300)
            .withEndAction {
                binding.lyricsContainer.visibility = targetVisibility
            }
            .start()
    }

    private fun startAlbumArtRotation() {
        // Subtle continuous rotation for album art
        binding.ivAlbumArt.animate()
            .rotationBy(360f)
            .setDuration(20000)
            .withEndAction { startAlbumArtRotation() }
            .start()
    }

    private fun stopAlbumArtRotation() {
        binding.ivAlbumArt.animate().cancel()
    }

    private fun animateButton(view: View) {
        view.animate()
            .scaleX(0.8f)
            .scaleY(0.8f)
            .setDuration(100)
            .withEndAction {
                view.animate()
                    .scaleX(1f)
                    .scaleY(1f)
                    .setDuration(100)
                    .start()
            }
            .start()
    }

    private fun formatTime(ms: Long): String {
        val minutes = TimeUnit.MILLISECONDS.toMinutes(ms)
        val seconds = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
        return String.format("%02d:%02d", minutes, seconds)
    }

    override fun onDestroy() {
        super.onDestroy()
        binding.ivAlbumArt.animate().cancel()
    }
}

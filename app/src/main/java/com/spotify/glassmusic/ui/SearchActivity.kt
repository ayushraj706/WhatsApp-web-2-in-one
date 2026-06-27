package com.spotify.glassmusic.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import com.spotify.glassmusic.databinding.ActivitySearchBinding
import com.spotify.glassmusic.player.MusicPlayerManager
import com.spotify.glassmusic.ui.adapter.SearchResultAdapter
import com.spotify.glassmusic.data.repository.MusicRepository
import kotlinx.coroutines.launch

@UnstableApi
class SearchActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySearchBinding
    private lateinit var playerManager: MusicPlayerManager
    private val repository = MusicRepository()
    private lateinit var searchAdapter: SearchResultAdapter
    private val searchHandler = Handler(Looper.getMainLooper())
    private var searchRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        binding = ActivitySearchBinding.inflate(layoutInflater)
        setContentView(binding.root)

        playerManager = MusicPlayerManager.getInstance(this)

        setupEdgeToEdge()
        setupRecyclerView()
        setupSearch()
    }

    private fun setupEdgeToEdge() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            binding.searchContainer.updatePadding(top = systemBars.top)
            insets
        }
    }

    private fun setupRecyclerView() {
        searchAdapter = SearchResultAdapter { song ->
            val currentList = searchAdapter.currentList
            playerManager.playSong(song, currentList)
            startActivity(Intent(this, PlayerActivity::class.java))
        }
        binding.rvSearchResults.apply {
            layoutManager = LinearLayoutManager(this@SearchActivity)
            adapter = searchAdapter
        }
    }

    private fun setupSearch() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchRunnable?.let { searchHandler.removeCallbacks(it) }
                if (!s.isNullOrBlank()) {
                    searchRunnable = Runnable { performSearch(s.toString()) }
                    searchHandler.postDelayed(searchRunnable!!, 500)
                } else {
                    searchAdapter.submitList(emptyList())
                    binding.tvNoResults.visibility = View.GONE
                }
            }

            override fun afterTextChanged(s: Editable?) {}
        })

        binding.etSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                performSearch(binding.etSearch.text.toString())
                true
            } else false
        }

        binding.btnBack.setOnClickListener { finish() }
        binding.btnClear.setOnClickListener {
            binding.etSearch.text.clear()
            searchAdapter.submitList(emptyList())
        }
    }

    private fun performSearch(query: String) {
        binding.progressBar.visibility = View.VISIBLE
        binding.tvNoResults.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val results = repository.searchSongs(query)
                binding.progressBar.visibility = View.GONE

                if (results.isEmpty()) {
                    binding.tvNoResults.visibility = View.VISIBLE
                    // 🔥 YAHAN FIX KIYA HAI 🔥
                    binding.tvNoResults.text = "No results found for '$query'"
                } else {
                    searchAdapter.submitList(results)
                }
            } catch (e: Exception) {
                binding.progressBar.visibility = View.GONE
                binding.tvNoResults.visibility = View.VISIBLE
                binding.tvNoResults.text = "Error: ${e.message}"
            }
        }
    }
}

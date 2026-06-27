package com.spotify.glassmusic.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.spotify.glassmusic.data.model.Song
import com.spotify.glassmusic.databinding.ItemSearchResultBinding
import java.util.concurrent.TimeUnit

class SearchResultAdapter(private val onClick: (Song) -> Unit) :
    ListAdapter<Song, SearchResultAdapter.SearchViewHolder>(SearchDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SearchViewHolder {
        val binding = ItemSearchResultBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return SearchViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SearchViewHolder, position: Int) {
        holder.bind(getItem(position), position + 1)
    }

    inner class SearchViewHolder(private val binding: ItemSearchResultBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(song: Song, number: Int) {
            binding.tvNumber.text = number.toString()
            binding.tvTitle.text = song.title
            binding.tvArtist.text = song.artist
            binding.tvDuration.text = formatDuration(song.duration)

            Glide.with(binding.root)
                .load(song.thumbnailUrl)
                .centerCrop()
                .into(binding.ivThumbnail)

            binding.root.setOnClickListener { onClick(song) }
        }

        private fun formatDuration(ms: Long): String {
            val minutes = TimeUnit.MILLISECONDS.toMinutes(ms)
            val seconds = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
            return String.format("%02d:%02d", minutes, seconds)
        }
    }

    class SearchDiffCallback : DiffUtil.ItemCallback<Song>() {
        override fun areItemsTheSame(oldItem: Song, newItem: Song) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Song, newItem: Song) = oldItem == newItem
    }
}

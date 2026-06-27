package com.spotify.glassmusic.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.view.KeyEvent
import com.spotify.glassmusic.player.MusicPlayerManager

class MediaButtonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_MEDIA_BUTTON) {
            val keyEvent = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
            keyEvent?.let {
                if (it.action == KeyEvent.ACTION_DOWN) {
                    val playerManager = MusicPlayerManager.getInstance(context)
                    when (it.keyCode) {
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> playerManager.playPause()
                        KeyEvent.KEYCODE_MEDIA_NEXT -> playerManager.next()
                        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> playerManager.previous()
                    }
                }
            }
        }
    }
}

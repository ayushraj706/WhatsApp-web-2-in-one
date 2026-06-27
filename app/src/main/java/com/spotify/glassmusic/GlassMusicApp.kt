package com.spotify.glassmusic

import android.app.Application
import androidx.media3.common.util.UnstableApi
import com.bumptech.glide.Glide
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization

@UnstableApi
class GlassMusicApp : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize NewPipe Extractor
        NewPipe.init(DownloaderImpl.init(null), Localization.fromLocalizationCode("en-IN"))

        // Configure Glide
        Glide.get(this)
    }

    companion object {
        lateinit var instance: GlassMusicApp
            private set
    }
}

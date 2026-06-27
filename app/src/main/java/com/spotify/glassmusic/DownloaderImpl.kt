package com.spotify.glassmusic

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.io.IOException
import java.util.concurrent.TimeUnit

class DownloaderImpl private constructor() : Downloader() {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(30, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .build()

    companion object {
        private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        private var instance: DownloaderImpl? = null

        fun init(nullableCookie: String?): DownloaderImpl {
            instance = DownloaderImpl()
            return instance!!
        }
    }

    @Throws(IOException::class, ReCaptchaException::class)
    override fun execute(request: Request): Response {
        val okHttpRequest = okhttp3.Request.Builder()
            .url(request.url())
            .apply {
                request.headers().forEach { (key, value) ->
                    addHeader(key, value)
                }
                if (!request.headers().containsKey("User-Agent")) {
                    addHeader("User-Agent", USER_AGENT)
                }
                if (request.httpMethod() == "POST") {
                    // Modern RequestBody syntax
                    post(request.dataToSend()?.toRequestBody() ?: byteArrayOf().toRequestBody())
                }
            }
            .build()

        val response = client.newCall(okHttpRequest).execute()
        
        // Modern property access (no parentheses)
        val body = response.body?.string() ?: ""

        return Response(
            response.code,
            response.message,
            response.headers.toMultimap(), // NewPipe expects Map<String, List<String>>
            body,
            request.url()
        )
    }
}

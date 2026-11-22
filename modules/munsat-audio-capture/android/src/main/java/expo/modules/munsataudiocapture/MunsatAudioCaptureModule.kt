package expo.modules.munsataudiocapture

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaRecorder
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.math.max

private const val SAMPLE_RATE = 16000
private const val MAX_RECORDING_MS = 120000L

private sealed class CaptureAction {
  object StartRecording : CaptureAction()
  data class StopRecording(val reason: String) : CaptureAction()
  object CancelRecording : CaptureAction()
}

private class AacMuxerWriter(private val output: File) {
  private val encoder: MediaCodec
  private val muxer: MediaMuxer
  private var trackIndex = -1
  private var muxerStarted = false
  private var totalSamples = 0L
  private val info = MediaCodec.BufferInfo()

  init {
    output.parentFile?.mkdirs()
    muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, 1)
    format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
    format.setInteger(MediaFormat.KEY_BIT_RATE, 24000)
    format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 8192)
    encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    encoder.start()
  }

  fun write(samples: ShortArray, length: Int) {
    var offset = 0
    while (offset < length) {
      val inputIndex = encoder.dequeueInputBuffer(10000)
      if (inputIndex < 0) {
        drain(false)
        continue
      }
      val input = encoder.getInputBuffer(inputIndex) ?: throw IllegalStateException("تعذر الوصول إلى مخزن الصوت.")
      input.clear()
      val count = minOf(length - offset, input.remaining() / 2)
      input.order(ByteOrder.LITTLE_ENDIAN)
      for (i in 0 until count) input.putShort(samples[offset + i])
      val pts = totalSamples * 1000000L / SAMPLE_RATE
      encoder.queueInputBuffer(inputIndex, 0, count * 2, pts, 0)
      totalSamples += count
      offset += count
      drain(false)
    }
  }

  private fun drain(endOfStream: Boolean) {
    var idleRounds = 0
    while (true) {
      val outputIndex = encoder.dequeueOutputBuffer(info, if (endOfStream) 10000 else 0)
      when {
        outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream || idleRounds++ > 30) return
        }
        outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          if (muxerStarted) throw IllegalStateException("تغير تنسيق الصوت بعد بدء الحفظ.")
          trackIndex = muxer.addTrack(encoder.outputFormat)
          muxer.start()
          muxerStarted = true
        }
        outputIndex >= 0 -> {
          val encoded = encoder.getOutputBuffer(outputIndex)
          if (encoded != null && info.size > 0 && muxerStarted && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
            encoded.position(info.offset)
            encoded.limit(info.offset + info.size)
            muxer.writeSampleData(trackIndex, encoded, info)
          }
          val eos = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
          encoder.releaseOutputBuffer(outputIndex, false)
          if (eos) return
        }
        else -> return
      }
    }
  }

  fun finish() {
    try {
      var queued = false
      while (!queued) {
        val inputIndex = encoder.dequeueInputBuffer(10000)
        if (inputIndex >= 0) {
          val pts = totalSamples * 1000000L / SAMPLE_RATE
          encoder.queueInputBuffer(inputIndex, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
          queued = true
        } else {
          drain(false)
        }
      }
      drain(true)
    } finally {
      try { encoder.stop() } catch (_: Exception) {}
      try { encoder.release() } catch (_: Exception) {}
      try { if (muxerStarted) muxer.stop() } catch (_: Exception) {}
      try { muxer.release() } catch (_: Exception) {}
    }
  }
}

class MunsatAudioCaptureModule : Module() {
  @Volatile private var running = false
  @Volatile private var audioRecord: AudioRecord? = null
  @Volatile private var captureThread: Thread? = null
  @Volatile private var activeRecording = false
  @Volatile private var recordingStartedAt = 0L
  @Volatile private var commandGrammar: List<String> = emptyList()
  @Volatile private var recordingGrammar: List<String> = emptyList()
  @Volatile private var pendingGrammar: List<String> = emptyList()
  private val actions = ConcurrentLinkedQueue<CaptureAction>()
  private var model: Model? = null
  private var loadedModelPath: String? = null

  override fun definition() = ModuleDefinition {
    Name("MunsatAudioCapture")
    Events("onCommand", "onRecordingStarted", "onRecordingStopped", "onRecordingCancelled", "onCaptureError")

    AsyncFunction("startSession") { modelPath: String, idleGrammar: List<String>, recordGrammar: List<String> ->
      startSession(modelPath, idleGrammar, recordGrammar)
    }
    AsyncFunction("stopSession") { stopSession() }
    AsyncFunction("startRecording") {
      if (!running) throw IllegalStateException("التعرف الصوتي غير نشط.")
      actions.add(CaptureAction.StartRecording)
    }
    AsyncFunction("stopRecording") { reason: String ->
      actions.add(CaptureAction.StopRecording(reason))
    }
    AsyncFunction("cancelRecording") {
      actions.add(CaptureAction.CancelRecording)
    }
    Function("isRecording") { activeRecording }
    OnDestroy {
      stopSession()
      try { model?.close() } catch (_: Exception) {}
      model = null
    }
  }

  @Synchronized
  private fun startSession(path: String, idle: List<String>, recording: List<String>) {
    if (running) return
    val cleanPath = path.removePrefix("file://")
    if (model == null || loadedModelPath != cleanPath) {
      try { model?.close() } catch (_: Exception) {}
      model = Model(cleanPath)
      loadedModelPath = cleanPath
    }
    commandGrammar = idle
    recordingGrammar = recording
    pendingGrammar = idle
    actions.clear()

    val minBuffer = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    )
    if (minBuffer <= 0) throw IllegalStateException("تعذر تهيئة الميكروفون على هذا الجهاز.")
    val record = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      max(minBuffer, SAMPLE_RATE * 2)
    )
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("الميكروفون غير متاح. أغلق أي تطبيق يستخدمه ثم حاول مجددًا.")
    }

    audioRecord = record
    running = true
    captureThread = Thread({ captureLoop(record, model!!) }, "MunsatSharedMic").also { it.start() }
  }

  private fun captureLoop(record: AudioRecord, loadedModel: Model) {
    var recognizer: Recognizer? = null
    var activeGrammar = emptyList<String>()
    var writer: AacMuxerWriter? = null
    var file: File? = null
    val buffer = ShortArray(2048)

    fun createRecognizer(grammar: List<String>): Recognizer {
      return Recognizer(loadedModel, SAMPLE_RATE.toFloat(), JSONArray(grammar).toString())
    }

    fun changeGrammarIfNeeded() {
      val wanted = pendingGrammar
      if (activeGrammar != wanted) {
        try { recognizer?.close() } catch (_: Exception) {}
        recognizer = createRecognizer(wanted)
        activeGrammar = wanted
      }
    }

    fun finishRecording(reason: String, cancel: Boolean) {
      val savedFile = file
      val elapsedDuration = if (recordingStartedAt > 0L) (SystemClock.elapsedRealtime() - recordingStartedAt).coerceAtLeast(0L) else 0L
      try { writer?.finish() } catch (e: Exception) {
        sendEvent("onCaptureError", mapOf("message" to (e.message ?: "تعذر حفظ التسجيل.")))
      }
      writer = null
      file = null
      activeRecording = false
      recordingStartedAt = 0L
      pendingGrammar = commandGrammar
      if (cancel) {
        try { savedFile?.delete() } catch (_: Exception) {}
        sendEvent("onRecordingCancelled", emptyMap<String, Any>())
      } else if (savedFile != null && savedFile.exists() && savedFile.length() > 0) {
        sendEvent("onRecordingStopped", mapOf(
          "uri" to ("file://" + savedFile.absolutePath),
          "durationMs" to elapsedDuration,
          "reason" to reason
        ))
      } else {
        sendEvent("onCaptureError", mapOf("message" to "لم ينتج التسجيل ملفًا صوتيًا صالحًا."))
      }
    }

    try {
      record.startRecording()
      if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        throw IllegalStateException("لم يبدأ الميكروفون التسجيل.")
      }
      while (running && !Thread.currentThread().isInterrupted) {
        var action = actions.poll()
        while (action != null) {
          when (action) {
            CaptureAction.StartRecording -> {
              if (!activeRecording) {
                try {
                  val cacheDir = appContext.reactContext?.cacheDir ?: throw IllegalStateException("تعذر الوصول إلى مساحة التطبيق.")
                  val out = File(cacheDir, "munsat-voice-" + System.currentTimeMillis() + ".m4a")
                  writer = AacMuxerWriter(out)
                  file = out
                  recordingStartedAt = SystemClock.elapsedRealtime()
                  activeRecording = true
                  pendingGrammar = recordingGrammar
                  sendEvent("onRecordingStarted", mapOf("startedAt" to recordingStartedAt))
                } catch (e: Exception) {
                  writer = null
                  file = null
                  activeRecording = false
                  pendingGrammar = commandGrammar
                  sendEvent("onCaptureError", mapOf("message" to (e.message ?: "تعذر بدء التسجيل.")))
                }
              }
            }
            is CaptureAction.StopRecording -> {
              if (activeRecording) finishRecording(action.reason, false)
            }
            CaptureAction.CancelRecording -> {
              if (activeRecording) finishRecording("cancelled", true)
            }
          }
          action = actions.poll()
        }

        changeGrammarIfNeeded()
        val read = record.read(buffer, 0, buffer.size)
        if (read > 0) {
          if (activeRecording) {
            try { writer?.write(buffer, read) } catch (e: Exception) {
              finishRecording("error", true)
              sendEvent("onCaptureError", mapOf("message" to (e.message ?: "توقف حفظ التسجيل.")))
            }
          }

          val activeRecognizer = recognizer
          if (activeRecognizer != null && activeRecognizer.acceptWaveForm(buffer, read)) {
            val json = activeRecognizer.result
            val text = try { JSONObject(json).optString("text", "").trim() } catch (_: Exception) { "" }
            if (text.isNotBlank() && text != "[unk]") {
              sendEvent("onCommand", mapOf("text" to text, "recording" to activeRecording))
            }
          }

          if (activeRecording && SystemClock.elapsedRealtime() - recordingStartedAt >= MAX_RECORDING_MS) {
            finishRecording("limit", false)
          }
        } else if (read < 0) {
          throw IllegalStateException("انقطع اتصال الميكروفون.")
        }
      }
    } catch (e: Exception) {
      sendEvent("onCaptureError", mapOf("message" to (e.message ?: "حدث خطأ في التقاط الصوت.")))
    } finally {
      if (activeRecording) finishRecording("sessionStopped", true)
      try { recognizer?.close() } catch (_: Exception) {}
      try { record.stop() } catch (_: Exception) {}
      try { record.release() } catch (_: Exception) {}
      if (audioRecord === record) audioRecord = null
      running = false
      activeRecording = false
      captureThread = null
    }
  }

  @Synchronized
  private fun stopSession() {
    running = false
    try { audioRecord?.stop() } catch (_: Exception) {}
    try { captureThread?.join(1800) } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
  }
}

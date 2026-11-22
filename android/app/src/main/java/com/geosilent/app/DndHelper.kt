package com.geosilent.app

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log

/**
 * Inbuilt Native Android Do Not Disturb (DND) & Audio Controller.
 * Directly controls hardware DND, ringer volume, and emergency call breakthrough
 * via official Android OS APIs (NotificationManager & AudioManager) with ZERO third-party apps.
 */
class DndHelper(private val context: Context) {

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private val audioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    data class SavedAudioState(
        val filter: Int,
        val ringerMode: Int,
        val ringVolume: Int
    )

    companion object {
        private const val TAG = "SmartSilentZone_Dnd"
    }

    /**
     * Checks if user has granted inbuilt Notification Policy Access (DND permission).
     */
    fun hasNotificationPolicyAccess(): Boolean {
        return notificationManager.isNotificationPolicyAccessGranted
    }

    /**
     * Returns an intent that opens Android's official Do Not Disturb access permission screen.
     */
    fun getNotificationPolicyAccessIntent(): Intent {
        return Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
    }

    /**
     * Ensures OS-level Priority DND policy permits alarms, starred contacts, and repeat callers.
     */
    private fun configurePriorityPolicy() {
        if (!hasNotificationPolicyAccess()) return
        try {
            val current = notificationManager.notificationPolicy
            val updatedCategories = (current?.priorityCategories ?: 0) or
                NotificationManager.Policy.PRIORITY_CATEGORY_CALLS or
                NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS or
                NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS
            val updated = NotificationManager.Policy(
                updatedCategories,
                NotificationManager.Policy.PRIORITY_CALL_SENDERS_STARRED,
                current?.priorityMessageSenders ?: NotificationManager.Policy.PRIORITY_MESSAGE_SENDERS_STARRED
            )
            notificationManager.notificationPolicy = updated
        } catch (e: Exception) {
            Log.w(TAG, "Unable to update notification policy exceptions: ${e.message}")
        }
    }

    /**
     * Activates inbuilt silence matching the Smart Silent Zone profile:
     * - "silent"   -> Total Silence DND (INTERRUPTION_FILTER_NONE)
     * - "priority" -> Priority Only DND (INTERRUPTION_FILTER_PRIORITY, allows alarms/VIPs)
     * - "vibrate"  -> Vibrate Only (AudioManager.RINGER_MODE_VIBRATE)
     */
    fun activateForSilenceMode(silenceMode: String? = "silent"): Boolean {
        if (!hasNotificationPolicyAccess()) {
            Log.w(TAG, "Cannot activate inbuilt DND: Notification Policy Access is not granted.")
            return false
        }

        val normalized = silenceMode?.lowercase()?.trim() ?: "silent"
        return try {
            when (normalized) {
                "vibrate" -> {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
                    audioManager.ringerMode = AudioManager.RINGER_MODE_VIBRATE
                    Log.i(TAG, "Inbuilt Vibrate-Only mode activated natively.")
                    audioManager.ringerMode == AudioManager.RINGER_MODE_VIBRATE
                }
                "priority" -> {
                    configurePriorityPolicy()
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
                    Log.i(TAG, "Inbuilt Priority DND activated natively (emergency contacts allowed).")
                    isDndActive()
                }
                else -> {
                    // Total silence ("silent")
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
                    Log.i(TAG, "Inbuilt Total Silence DND activated natively.")
                    isDndActive()
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while activating inbuilt DND: ${e.message}", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error while activating inbuilt DND: ${e.message}", e)
            false
        }
    }

    /**
     * Convenience wrapper for default PRIORITY / DND activation.
     */
    fun activateDnd(filterMode: Int = NotificationManager.INTERRUPTION_FILTER_PRIORITY): Boolean {
        return when (filterMode) {
            NotificationManager.INTERRUPTION_FILTER_NONE -> activateForSilenceMode("silent")
            else -> activateForSilenceMode("priority")
        }
    }

    /**
     * Deactivates inbuilt Do Not Disturb mode and restores normal ringer volume.
     */
    fun deactivateDnd(): Boolean {
        if (!hasNotificationPolicyAccess()) {
            Log.w(TAG, "Cannot deactivate DND: Notification Policy Access is not granted.")
            return false
        }

        return try {
            notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            if (audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL) {
                audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
            }
            Log.i(TAG, "Inbuilt Android DND deactivated. Normal ringer restored.")
            !isDndActive()
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while deactivating DND: ${e.message}", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error while deactivating DND: ${e.message}", e)
            false
        }
    }

    /**
     * Temporarily lifts active DND and boosts mobile ring volume so an emergency contact call rings loudly.
     */
    fun temporarilyAllowEmergencyRing(reason: String): SavedAudioState {
        val currentFilter = notificationManager.currentInterruptionFilter
        val currentRinger = audioManager.ringerMode
        val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_RING)
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING).coerceAtLeast(1)

        try {
            if (hasNotificationPolicyAccess()) {
                notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            }
            audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
            val targetVol = maxOf(currentVol, (maxVol * 0.85f).toInt().coerceAtLeast(1))
            audioManager.setStreamVolume(AudioManager.STREAM_RING, targetVol, 0)
            Log.i(TAG, "Emergency breakthrough engaged ($reason): ring volume=$targetVol/$maxVol")
        } catch (e: Exception) {
            Log.e(TAG, "Failed lifting DND for emergency call: ${e.message}", e)
        }

        return SavedAudioState(
            filter = currentFilter,
            ringerMode = currentRinger,
            ringVolume = currentVol
        )
    }

    /**
     * Restores ringtone volume and re-applies Silent Zone DND after an emergency call completes.
     */
    fun restoreAfterEmergencyRing(
        savedFilter: Int,
        savedRingerMode: Int,
        savedRingVolume: Int,
        activeZoneSilenceMode: String?
    ) {
        try {
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING).coerceAtLeast(1)
            val safeVol = savedRingVolume.coerceIn(0, maxVol)
            audioManager.setStreamVolume(AudioManager.STREAM_RING, safeVol, 0)

            if (!activeZoneSilenceMode.isNullOrBlank() && hasNotificationPolicyAccess()) {
                activateForSilenceMode(activeZoneSilenceMode)
            } else if (hasNotificationPolicyAccess()) {
                if (savedFilter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
                    notificationManager.setInterruptionFilter(savedFilter)
                }
                audioManager.ringerMode = savedRingerMode
            }
            Log.i(TAG, "Restored pre-emergency DND & ringer volume cleanly.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed restoring DND after emergency call: ${e.message}", e)
        }
    }

    /**
     * Plays a real 3-second test ringtone on device hardware bypassing DND, then restores previous DND state.
     */
    fun playEmergencyTestRing(durationMs: Long = 3200L): Boolean {
        return try {
            val wasSilenced = isSilencedOnHardware()
            val saved = temporarilyAllowEmergencyRing("Test Emergency Ring")

            val ringUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(context, ringUri)
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtone.audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                }
                ringtone.play()
            }

            triggerEmergencyVibration()

            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    ringtone?.stop()
                } catch (_: Exception) {}
                if (wasSilenced) {
                    val activeMode = FirebaseSyncManager.getInstance(context).getActiveZoneSilenceMode()
                    restoreAfterEmergencyRing(saved.filter, saved.ringerMode, saved.ringVolume, activeMode)
                } else {
                    restoreAfterEmergencyRing(saved.filter, saved.ringerMode, saved.ringVolume, null)
                }
            }, durationMs)

            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed playing test emergency ringtone: ${e.message}", e)
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun triggerEmergencyVibration() {
        try {
            val pattern = longArrayOf(0, 350, 150, 350, 150, 400)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
                } else {
                    vibrator.vibrate(pattern, -1)
                }
            }
        } catch (_: Exception) {}
    }

    /**
     * Checks if Do Not Disturb interruption filter is currently active on Android OS.
     */
    fun isDndActive(): Boolean {
        val currentFilter = notificationManager.currentInterruptionFilter
        return currentFilter != NotificationManager.INTERRUPTION_FILTER_ALL &&
               currentFilter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN
    }

    /**
     * Checks if either native DND filter OR hardware Vibrate mode is engaged.
     */
    fun isSilencedOnHardware(): Boolean {
        return isDndActive() || audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL
    }

    fun getRingerModeName(): String {
        return when (audioManager.ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> "SILENT"
            AudioManager.RINGER_MODE_VIBRATE -> "VIBRATE"
            AudioManager.RINGER_MODE_NORMAL -> "NORMAL"
            else -> "UNKNOWN"
        }
    }

    /**
     * Gets a readable string representation of current interruption filter.
     */
    fun getInterruptionFilterName(): String {
        return when (notificationManager.currentInterruptionFilter) {
            NotificationManager.INTERRUPTION_FILTER_ALL -> {
                if (audioManager.ringerMode == AudioManager.RINGER_MODE_VIBRATE) {
                    "VIBRATE_ONLY"
                } else {
                    "ALL (Normal)"
                }
            }
            NotificationManager.INTERRUPTION_FILTER_PRIORITY -> "PRIORITY (DND Active)"
            NotificationManager.INTERRUPTION_FILTER_NONE -> "TOTAL_SILENCE (DND Active)"
            NotificationManager.INTERRUPTION_FILTER_ALARMS -> "ALARMS_ONLY (DND Active)"
            else -> "UNKNOWN"
        }
    }
}

package com.geosilent.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Inbuilt Emergency Call Breakthrough Receiver.
 * Monitors incoming phone state natively via TelephonyManager (ZERO third-party apps).
 * When a saved emergency number or repeat caller rings while DND or Vibrate mode is active,
 * temporarily restores normal ringer & ringtone volume so the mobile rings out loud,
 * then automatically re-engages the Silent Zone's DND profile once the call ends.
 */
class EmergencyCallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmartSilentZone_CallRx"
        private const val CHANNEL_ID = "geosilent_emergency_calls"
        private const val NOTIFICATION_ID = 9944
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val dndHelper = DndHelper(context)
        val emergencyManager = EmergencyContactsManager.getInstance(context)
        val syncManager = FirebaseSyncManager.getInstance(context)

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                @Suppress("DEPRECATION")
                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                if (incomingNumber.isNullOrBlank()) {
                    // Android sends an initial PHONE_STATE broadcast without number before the second broadcast with number
                    return
                }

                if (!dndHelper.isSilencedOnHardware()) {
                    Log.d(TAG, "Ringer already normal; no DND breakthrough needed.")
                    return
                }

                val match = emergencyManager.evaluateIncomingCall(incomingNumber) ?: return
                if (!emergencyManager.isBreakthroughActive()) {
                    val saved = dndHelper.temporarilyAllowEmergencyRing(match.reason)
                    val activeSilenceMode = syncManager.getActiveZoneSilenceMode()
                    emergencyManager.saveBreakthroughRestoreState(
                        savedFilter = saved.filter,
                        savedRingerMode = saved.ringerMode,
                        savedRingVolume = saved.ringVolume,
                        activeZoneSilenceMode = activeSilenceMode
                    )
                    Log.i(TAG, "Emergency call ringing! Bypassed DND for ${match.contactName} (${match.phone})")
                    showBreakthroughNotification(
                        context,
                        title = "Emergency Ringing: ${match.contactName}",
                        message = "${match.reason}. DND bypassed so your phone rings out loud."
                    )
                }
            }

            TelephonyManager.EXTRA_STATE_IDLE -> {
                val restoreState = emergencyManager.consumeBreakthroughRestoreState() ?: return
                dndHelper.restoreAfterEmergencyRing(
                    savedFilter = restoreState.savedFilter,
                    savedRingerMode = restoreState.savedRingerMode,
                    savedRingVolume = restoreState.savedRingVolume,
                    activeZoneSilenceMode = restoreState.activeZoneSilenceMode
                )
                Log.i(TAG, "Emergency call ended. Re-engaged Silent Zone DND cleanly.")
            }
        }
    }

    private fun showBreakthroughNotification(context: Context, title: String, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Emergency Call Breakthrough",
                    NotificationManager.IMPORTANCE_HIGH
                )
                manager.createNotificationChannel(channel)
            }

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setAutoCancel(true)
                .build()

            manager.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.w(TAG, "Could not show emergency notification: ${e.message}")
        }
    }
}

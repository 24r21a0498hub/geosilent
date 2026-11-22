package com.geosilent.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingEvent

/**
 * BroadcastReceiver triggered by Android OS when device crosses a geofence boundary.
 * Activates inbuilt Android DND directly using NotificationManager without third-party apps.
 * Works even when the app is closed or the device screen is locked.
 */
class GeofenceBroadcastReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmartSilentZone_Rx"
        private const val CHANNEL_ID = "geosilent_dnd_alerts"
        private const val NOTIFICATION_ID = 9921
    }

    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        if (geofencingEvent == null) {
            Log.e(TAG, "GeofencingEvent is null")
            return
        }

        if (geofencingEvent.hasError()) {
            val errorMessage = GeofenceStatusCodes.getStatusCodeString(geofencingEvent.errorCode)
            Log.e(TAG, "Geofence event error: $errorMessage")
            return
        }

        val geofenceTransition = geofencingEvent.geofenceTransition
        val triggeringGeofences = geofencingEvent.triggeringGeofences ?: emptyList()
        val zoneId = triggeringGeofences.firstOrNull()?.requestId ?: "Unknown"

        val dndHelper = DndHelper(context)
        val firebaseSync = FirebaseSyncManager.getInstance(context)

        createNotificationChannel(context)

        when (geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> {
                val zoneName = firebaseSync.getCachedZoneName(zoneId) ?: "Silent Zone"
                val silenceMode = firebaseSync.getCachedZoneSilenceMode(zoneId)
                Log.i(TAG, "ENTERED Geofence: $zoneName ($zoneId) mode=$silenceMode")

                val activated = dndHelper.activateForSilenceMode(silenceMode)
                val isActuallySilenced = dndHelper.isSilencedOnHardware()
                if (activated && isActuallySilenced) {
                    firebaseSync.setActiveZoneSilenceMode(silenceMode)
                }

                if (activated && isActuallySilenced) {
                    val modeLabel = when (silenceMode) {
                        "vibrate" -> "Vibrate Only"
                        "priority" -> "Priority DND"
                        else -> "Do Not Disturb"
                    }
                    showHeadsUpNotification(
                        context,
                        title = "$modeLabel Activated",
                        message = "Entered \"$zoneName\". Inbuilt Android silence enabled."
                    )
                } else {
                    showHeadsUpNotification(
                        context,
                        title = "DND Permission Required",
                        message = "Entered \"$zoneName\". Open Smart Silent Zone and grant inbuilt DND access."
                    )
                }

                // Only report DND active when confirmed by Android OS NotificationManager/AudioManager
                firebaseSync.updateDeviceDndState(
                    dndActive = isActuallySilenced,
                    activeZoneName = if (isActuallySilenced) zoneName else "",
                    interruptionFilter = dndHelper.getInterruptionFilterName()
                )
            }

            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                val zoneName = firebaseSync.getCachedZoneName(zoneId) ?: "Silent Zone"
                Log.i(TAG, "EXITED Geofence: $zoneName ($zoneId). Restoring normal ringer...")

                firebaseSync.setActiveZoneSilenceMode(null)
                val deactivated = dndHelper.deactivateDnd()
                val isStillSilenced = dndHelper.isSilencedOnHardware()

                if (deactivated && !isStillSilenced) {
                    showHeadsUpNotification(
                        context,
                        title = "Normal Ringer Restored",
                        message = "Exited \"$zoneName\". Inbuilt normal mode restored."
                    )
                } else {
                    showHeadsUpNotification(
                        context,
                        title = "Could Not Restore Ringer",
                        message = "Exited \"$zoneName\". Open app to check inbuilt DND permission."
                    )
                }

                firebaseSync.updateDeviceDndState(
                    dndActive = isStillSilenced,
                    activeZoneName = if (isStillSilenced) zoneName else "",
                    interruptionFilter = dndHelper.getInterruptionFilterName()
                )
            }

            else -> {
                Log.d(TAG, "Unhandled geofence transition type: $geofenceTransition")
            }
        }
    }

    private fun showHeadsUpNotification(context: Context, title: String, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        try {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_silent_mode)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            notificationManager.notify(NOTIFICATION_ID, notification)
        } catch (secEx: SecurityException) {
            Log.w(TAG, "Notification permission rejected: ${secEx.message}")
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Silent Zone Alerts"
            val descriptionText = "Notifies when inbuilt Android DND is turned on or off based on location"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}

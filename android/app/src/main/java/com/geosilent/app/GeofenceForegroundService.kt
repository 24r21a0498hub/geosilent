package com.geosilent.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground Service guaranteeing background location monitoring and geofence
 * survivability even when the screen is locked or power management is active.
 */
class GeofenceForegroundService : Service() {

    companion object {
        private const val TAG = "SmartSilentZone_Svc"
        private const val CHANNEL_ID = "geosilent_foreground_service_channel"
        private const val SERVICE_NOTIFICATION_ID = 4041

        const val ACTION_START_MONITORING = "ACTION_START_MONITORING"
        const val ACTION_STOP_MONITORING = "ACTION_STOP_MONITORING"

        fun hasLocationPermission(context: Context): Boolean {
            val fine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        fun start(context: Context) {
            if (!hasLocationPermission(context)) {
                Log.w(TAG, "Skipping ForegroundService start: location permission not granted.")
                return
            }
            val intent = Intent(context, GeofenceForegroundService::class.java).apply {
                action = ACTION_START_MONITORING
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Unable to start foreground service: ${e.message}", e)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, GeofenceForegroundService::class.java).apply {
                action = ACTION_STOP_MONITORING
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping foreground service: ${e.message}")
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_MONITORING) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val dndHelper = DndHelper(this)
        val dndStatus = if (dndHelper.isSilencedOnHardware()) "Inbuilt DND Active" else "Normal Mode"
        val notification = buildOngoingNotification("Monitoring Silent Zones • $dndStatus")

        try {
            startForeground(SERVICE_NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed (check Android 14 location permission): ${e.message}", e)
            stopSelf()
            return START_NOT_STICKY
        }

        // Restore cached local geofences immediately and start Firestore sync if paired
        val syncManager = FirebaseSyncManager.getInstance(this)
        syncManager.restoreCachedGeofences()
        syncManager.startRealtimeSync()

        return START_STICKY
    }

    private fun buildOngoingNotification(statusText: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Smart Silent Zone")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Geofence Monitoring Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows ongoing status of automatic silent zone monitoring"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}

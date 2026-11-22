package com.geosilent.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Re-initiates geofence registration and starts the persistent foreground service on device boot
 * when monitoring was previously enabled by the user.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val syncManager = FirebaseSyncManager.getInstance(context)
            if (syncManager.isMonitoringEnabled()) {
                Log.i("SmartSilentZone_Boot", "Device boot completed. Restarting Smart Silent Zone monitoring...")
                GeofenceForegroundService.start(context)
            } else {
                Log.i("SmartSilentZone_Boot", "Device boot completed. Monitoring is paused by user.")
            }
        }
    }
}

package com.geosilent.app

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

/**
 * Manages Google Play Services Geofencing APIs.
 * Automatically adds, updates, and removes native geofences based on synced Firestore zones.
 */
class GeofenceManager(private val context: Context) {

    private val geofencingClient: GeofencingClient =
        LocationServices.getGeofencingClient(context)

    companion object {
        private const val TAG = "SmartSilentZone_Geo"
        private const val PENDING_INTENT_REQUEST_CODE = 4401
    }

    private val geofencePendingIntent: PendingIntent by lazy {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        PendingIntent.getBroadcast(context, PENDING_INTENT_REQUEST_CODE, intent, flags)
    }

    /**
     * Replaces registered Silent Zones into Android Geofencing API so deleted or edited zones
     * never leave stale OS geofences active.
     */
    @SuppressLint("MissingPermission")
    fun registerGeofences(zones: List<SilentZoneModel>, onComplete: (Boolean, String?) -> Unit) {
        val activeZones = zones.filter { it.enabled && it.radius >= 10f }

        geofencingClient.removeGeofences(geofencePendingIntent).addOnCompleteListener {
            if (activeZones.isEmpty()) {
                onComplete(true, "No active zones to monitor.")
                return@addOnCompleteListener
            }

            val geofenceList = activeZones.map { zone ->
                Geofence.Builder()
                    .setRequestId(zone.id)
                    .setCircularRegion(zone.lat, zone.lng, zone.radius)
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                    .setNotificationResponsiveness(5000) // 5s responsiveness balance
                    .build()
            }

            val geofencingRequest = GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                .addGeofences(geofenceList)
                .build()

            try {
                geofencingClient.addGeofences(geofencingRequest, geofencePendingIntent).run {
                    addOnSuccessListener {
                        Log.i(TAG, "Successfully registered ${geofenceList.size} geofences in Android OS.")
                        onComplete(true, null)
                    }
                    addOnFailureListener { exception ->
                        Log.e(TAG, "Failed to register geofences: ${exception.message}", exception)
                        onComplete(false, exception.message)
                    }
                }
            } catch (secEx: SecurityException) {
                Log.e(TAG, "Missing location permission for geofences: ${secEx.message}", secEx)
                onComplete(false, secEx.message)
            }
        }
    }

    /**
     * Removes all registered geofences.
     */
    fun removeAllGeofences(onComplete: ((Boolean) -> Unit)? = null) {
        geofencingClient.removeGeofences(geofencePendingIntent).run {
            addOnSuccessListener {
                Log.i(TAG, "All geofences cleared.")
                onComplete?.invoke(true)
            }
            addOnFailureListener {
                Log.w(TAG, "Failed to remove geofences: ${it.message}")
                onComplete?.invoke(false)
            }
        }
    }
}

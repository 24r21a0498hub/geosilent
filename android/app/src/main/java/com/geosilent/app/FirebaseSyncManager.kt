package com.geosilent.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Manages bi-directional synchronization between the Android APK, local offline cache,
 * and Firebase Firestore. Ensures geofences & zone silence profiles persist locally
 * even when running standalone without external pairing.
 */
class FirebaseSyncManager private constructor(private val context: Context) {

    private val firestore: FirebaseFirestore by lazy {
        try {
            FirebaseFirestore.getInstance(FirebaseApp.getInstance(), FIRESTORE_DATABASE_ID)
        } catch (e: Exception) {
            Log.w(TAG, "Named Firestore database init fallback: ${e.message}")
            FirebaseFirestore.getInstance()
        }
    }

    private val geofenceManager = GeofenceManager(context)
    private val dndHelper = DndHelper(context)
    private val prefs = context.getSharedPreferences("smart_silent_zone_prefs", Context.MODE_PRIVATE)

    private var zonesListenerRegistration: ListenerRegistration? = null
    private val cachedZoneNames = mutableMapOf<String, String>()
    private val cachedZoneModes = mutableMapOf<String, String>()

    companion object {
        private const val TAG = "SmartSilentZone_Sync"
        private const val FIRESTORE_DATABASE_ID = "ai-studio-geosilent-4b1361c2-283f-4955-9218-bb9f38c7c968"
        private const val PREF_PAIRING_CODE = "pairing_code"
        private const val PREF_MONITORING_ENABLED = "monitoring_enabled"
        private const val PREF_ZONE_NAME_PREFIX = "cached_zone_"
        private const val PREF_ZONE_MODE_PREFIX = "cached_zone_mode_"
        private const val PREF_CACHED_ZONES_JSON = "cached_zones_json"
        private const val PREF_ACTIVE_SILENCE_MODE = "active_zone_silence_mode"
        private const val PREF_MANUAL_PAUSED = "monitoring_manually_paused"

        @Volatile
        private var instance: FirebaseSyncManager? = null

        fun getInstance(context: Context): FirebaseSyncManager {
            return instance ?: synchronized(this) {
                instance ?: FirebaseSyncManager(context.applicationContext).also { instance = it }
            }
        }
    }

    fun getPairingCode(): String {
        return prefs.getString(PREF_PAIRING_CODE, "") ?: ""
    }

    fun setPairingCode(code: String) {
        val clean = code.trim().uppercase().replace(Regex("[^A-Z0-9-]"), "").take(32)
        prefs.edit().putString(PREF_PAIRING_CODE, clean).apply()
        startRealtimeSync()
    }

    fun isMonitoringEnabled(): Boolean {
        return prefs.getBoolean(PREF_MONITORING_ENABLED, false)
    }

    fun setMonitoringEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(PREF_MONITORING_ENABLED, enabled).apply()
    }

    fun wasManuallyPaused(): Boolean {
        return prefs.getBoolean(PREF_MANUAL_PAUSED, false)
    }

    fun setManuallyPaused(paused: Boolean) {
        prefs.edit().putBoolean(PREF_MANUAL_PAUSED, paused).apply()
    }

    fun setActiveZoneSilenceMode(silenceMode: String?) {
        if (silenceMode.isNullOrBlank()) {
            prefs.edit().remove(PREF_ACTIVE_SILENCE_MODE).apply()
        } else {
            prefs.edit().putString(PREF_ACTIVE_SILENCE_MODE, silenceMode).apply()
        }
    }

    fun getActiveZoneSilenceMode(): String? {
        return prefs.getString(PREF_ACTIVE_SILENCE_MODE, null)?.takeIf { it.isNotBlank() }
    }

    private fun getDeviceId(): String {
        val code = getPairingCode()
        if (code.isBlank()) return ""
        return ("dev_" + code.lowercase(Locale.US).replace(Regex("[^a-z0-9_-]"), "_")).take(128)
    }

    private fun getUtcIsoTimestamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    private fun hasBackgroundLocationPermission(): Boolean {
        val hasFine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine) return false

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Caches zones locally and refreshes Android GeofencingClient when monitoring is enabled.
     */
    fun cacheAndRegisterZones(zones: List<SilentZoneModel>) {
        val editor = prefs.edit()
        val jsonArray = JSONArray()

        zones.forEach { z ->
            cachedZoneNames[z.id] = z.name
            cachedZoneModes[z.id] = z.silenceMode
            editor.putString("$PREF_ZONE_NAME_PREFIX${z.id}", z.name)
            editor.putString("$PREF_ZONE_MODE_PREFIX${z.id}", z.silenceMode)

            val obj = JSONObject().apply {
                put("id", z.id)
                put("name", z.name)
                put("lat", z.lat)
                put("lng", z.lng)
                put("radius", z.radius.toDouble())
                put("mode", z.mode)
                put("silenceMode", z.silenceMode)
                put("enabled", z.enabled)
            }
            jsonArray.put(obj)
        }

        editor.putString(PREF_CACHED_ZONES_JSON, jsonArray.toString())
        editor.apply()

        if (isMonitoringEnabled()) {
            geofenceManager.registerGeofences(zones) { success, msg ->
                Log.i(TAG, "Geofence registration result: success=$success, detail=$msg")
            }
        }
    }

    /**
     * Called on boot or foreground service start to restore offline/local geofences immediately.
     */
    fun restoreCachedGeofences() {
        val raw = prefs.getString(PREF_CACHED_ZONES_JSON, null) ?: return
        try {
            val arr = JSONArray(raw)
            val zones = mutableListOf<SilentZoneModel>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val id = obj.optString("id", "").trim()
                if (id.isEmpty()) continue
                zones.add(
                    SilentZoneModel(
                        id = id,
                        name = obj.optString("name", "Silent Zone"),
                        lat = obj.optDouble("lat", 0.0),
                        lng = obj.optDouble("lng", 0.0),
                        radius = obj.optDouble("radius", 100.0).toFloat(),
                        mode = obj.optString("mode", "custom"),
                        silenceMode = obj.optString("silenceMode", "silent"),
                        enabled = obj.optBoolean("enabled", true)
                    )
                )
            }
            if (isMonitoringEnabled() && zones.isNotEmpty()) {
                geofenceManager.registerGeofences(zones) { success, msg ->
                    Log.i(TAG, "Restored ${zones.size} cached geofences: success=$success ($msg)")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed restoring cached geofences: ${e.message}")
        }
    }

    /**
     * Starts real-time listening to Firestore quiet zones created on the website.
     */
    fun startRealtimeSync() {
        restoreCachedGeofences()

        val deviceId = getDeviceId()
        if (deviceId.isBlank()) {
            Log.i(TAG, "Running in standalone APK mode (no remote pairing code needed).")
            return
        }

        zonesListenerRegistration?.remove()

        Log.i(TAG, "Connecting to Firestore ($FIRESTORE_DATABASE_ID) for device ID: $deviceId")
        publishDeviceTelemetry()

        val zonesQuery = firestore.collection("devices")
            .document(deviceId)
            .collection("zones")
            .whereEqualTo("deviceId", deviceId)

        zonesListenerRegistration = zonesQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.e(TAG, "Error listening to remote zones: ${error.message}", error)
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val zones = snapshot.documents.mapNotNull { doc ->
                    try {
                        val id = doc.getString("id") ?: doc.id
                        val name = doc.getString("name") ?: "Unnamed Zone"
                        val lat = doc.getDouble("lat") ?: 0.0
                        val lng = doc.getDouble("lng") ?: 0.0
                        val radius = (doc.getDouble("radius") ?: 100.0).toFloat()
                        val mode = doc.getString("mode") ?: "custom"
                        val silenceMode = doc.getString("silenceMode") ?: "silent"
                        val enabled = doc.getBoolean("enabled") ?: true

                        SilentZoneModel(id, name, lat, lng, radius, mode, silenceMode, enabled)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing zone doc: ${doc.id}", e)
                        null
                    }
                }

                Log.i(TAG, "Received ${zones.size} zones from Firestore. Updating Android Geofences...")
                cacheAndRegisterZones(zones)
            }
        }
    }

    fun getCachedZoneName(zoneId: String): String? {
        return cachedZoneNames[zoneId] ?: prefs.getString("$PREF_ZONE_NAME_PREFIX$zoneId", null)
    }

    fun getCachedZoneSilenceMode(zoneId: String): String {
        return cachedZoneModes[zoneId]
            ?: prefs.getString("$PREF_ZONE_MODE_PREFIX$zoneId", null)
            ?: "silent"
    }

    /**
     * Publishes real-time device health, native DND state, and permissions to Firestore.
     */
    fun updateDeviceDndState(dndActive: Boolean, activeZoneName: String, interruptionFilter: String) {
        val deviceId = getDeviceId()
        val pairingCode = getPairingCode()
        if (deviceId.isBlank() || pairingCode.isBlank()) return

        val batteryLevel = getBatteryLevel()
        val hasDnd = dndHelper.hasNotificationPolicyAccess()
        val hasBgLoc = hasBackgroundLocationPermission()

        val updateData = hashMapOf<String, Any>(
            "deviceId" to deviceId,
            "pairingCode" to pairingCode,
            "dndActive" to dndActive,
            "activeZoneName" to activeZoneName.take(128),
            "interruptionFilter" to interruptionFilter.take(64),
            "connected" to true,
            "lastHeartbeat" to System.currentTimeMillis(),
            "permissionDndGranted" to hasDnd,
            "permissionBackgroundLocation" to hasBgLoc,
            "monitoringEnabled" to isMonitoringEnabled(),
            "batteryLevel" to batteryLevel,
            "updatedAt" to getUtcIsoTimestamp()
        )

        firestore.collection("devices").document(deviceId)
            .set(updateData, SetOptions.merge())
            .addOnSuccessListener {
                Log.d(TAG, "Successfully synced DND state ($dndActive) to website")
            }
            .addOnFailureListener {
                Log.w(TAG, "Failed to update DND state: ${it.message}")
            }
    }

    fun publishDeviceTelemetry() {
        val deviceId = getDeviceId()
        val pairingCode = getPairingCode()
        if (deviceId.isBlank() || pairingCode.isBlank()) return

        val deviceData = hashMapOf<String, Any>(
            "deviceId" to deviceId,
            "pairingCode" to pairingCode,
            "deviceName" to "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}".take(128),
            "connected" to true,
            "lastHeartbeat" to System.currentTimeMillis(),
            "dndActive" to dndHelper.isSilencedOnHardware(),
            "interruptionFilter" to dndHelper.getInterruptionFilterName().take(64),
            "permissionDndGranted" to dndHelper.hasNotificationPolicyAccess(),
            "permissionBackgroundLocation" to hasBackgroundLocationPermission(),
            "monitoringEnabled" to isMonitoringEnabled(),
            "batteryLevel" to getBatteryLevel(),
            "appVersion" to "2.0.0",
            "updatedAt" to getUtcIsoTimestamp()
        )

        firestore.collection("devices").document(deviceId)
            .set(deviceData, SetOptions.merge())
            .addOnSuccessListener {
                Log.i(TAG, "Device telemetry successfully published for code: $pairingCode")
            }
            .addOnFailureListener {
                Log.w(TAG, "Failed to publish device telemetry: ${it.message}")
            }
    }

    private fun getBatteryLevel(): Int {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level != -1 && scale > 0) {
            ((level / scale.toFloat()) * 100).toInt().coerceIn(0, 100)
        } else {
            100
        }
    }

    fun stopSync() {
        zonesListenerRegistration?.remove()
        zonesListenerRegistration = null
    }
}

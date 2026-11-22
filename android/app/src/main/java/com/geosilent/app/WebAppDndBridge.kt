package com.geosilent.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Inbuilt WebView <-> Native Android NotificationManager & Emergency Call Bridge.
 * Injected into the embedded dashboard WebView as `window.AndroidNativeDnd`
 * so the APK triggers inbuilt location, DND, and emergency contact ring-through directly
 * with ZERO third-party apps.
 */
class WebAppDndBridge(
    private val context: Context,
    private val onRequestAllPermissions: () -> Unit,
    private val onRequestLocationPermission: () -> Unit,
    private val onRequestEmergencyPermissions: () -> Unit,
    private val onRequestBatteryExemption: () -> Unit,
    private val onStateChanged: () -> Unit
) {

    private val dndHelper = DndHelper(context)
    private val syncManager = FirebaseSyncManager.getInstance(context)
    private val emergencyManager = EmergencyContactsManager.getInstance(context)
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "SmartSilentZone_Bridge"
    }

    @JavascriptInterface
    fun isInbuiltApk(): Boolean = true

    @JavascriptInterface
    fun hasDndPermission(): Boolean = dndHelper.hasNotificationPolicyAccess()

    @JavascriptInterface
    fun isDndActive(): Boolean = dndHelper.isSilencedOnHardware()

    @JavascriptInterface
    fun hasLocationPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun hasBackgroundLocationPermission(): Boolean {
        if (!hasLocationPermissions()) return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    @JavascriptInterface
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    @JavascriptInterface
    fun hasBatteryOptimizationExemption(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
        } else {
            true
        }
    }

    @JavascriptInterface
    fun hasEmergencyCallPermissions(): Boolean {
        val phoneState = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED
        val callLog = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        return phoneState && callLog
    }

    @JavascriptInterface
    fun requestDndPermission() {
        mainHandler.post {
            try {
                context.startActivity(dndHelper.getNotificationPolicyAccessIntent())
            } catch (e: Exception) {
                Log.e(TAG, "Unable to launch DND permission settings: ${e.message}", e)
            }
        }
    }

    @JavascriptInterface
    fun requestLocationPermissions() {
        mainHandler.post {
            onRequestLocationPermission()
        }
    }

    @JavascriptInterface
    fun requestEmergencyCallPermissions() {
        mainHandler.post {
            onRequestEmergencyPermissions()
        }
    }

    @JavascriptInterface
    fun requestBatteryOptimizationExemption() {
        mainHandler.post {
            onRequestBatteryExemption()
        }
    }

    @JavascriptInterface
    fun requestAllInbuiltAccess() {
        mainHandler.post {
            onRequestAllPermissions()
        }
    }

    @JavascriptInterface
    fun getDndStatusJson(): String {
        return try {
            JSONObject().apply {
                put("inbuilt", true)
                put("granted", dndHelper.hasNotificationPolicyAccess())
                put("dndActive", dndHelper.isSilencedOnHardware())
                put("filterName", dndHelper.getInterruptionFilterName())
                put("ringerMode", dndHelper.getRingerModeName())
                put("sdkInt", Build.VERSION.SDK_INT)
                put("monitoringEnabled", syncManager.isMonitoringEnabled())
                put("locationGranted", hasLocationPermissions())
                put("backgroundLocationGranted", hasBackgroundLocationPermission())
                put("notificationsGranted", hasNotificationPermission())
                put("batteryUnrestricted", hasBatteryOptimizationExemption())
                put("emergencyCallGranted", hasEmergencyCallPermissions())
                put("emergencyContactsCount", emergencyManager.getContacts().size)
            }.toString()
        } catch (e: Exception) {
            "{\"inbuilt\":true,\"granted\":false,\"dndActive\":false}"
        }
    }

    @JavascriptInterface
    fun setDndState(enable: Boolean, silenceMode: String?, zoneName: String?): String {
        val hasAccess = dndHelper.hasNotificationPolicyAccess()
        var success = false

        if (hasAccess) {
            success = if (enable) {
                dndHelper.activateForSilenceMode(silenceMode ?: "silent")
            } else {
                dndHelper.deactivateDnd()
            }
        }

        val hardwareActive = dndHelper.isSilencedOnHardware()
        val filterName = dndHelper.getInterruptionFilterName()

        syncManager.setActiveZoneSilenceMode(if (hardwareActive) (silenceMode ?: "silent") else null)
        syncManager.updateDeviceDndState(
            dndActive = hardwareActive,
            activeZoneName = if (hardwareActive) (zoneName ?: "Silent Zone") else "",
            interruptionFilter = filterName
        )

        mainHandler.post { onStateChanged() }

        return try {
            JSONObject().apply {
                put("success", success && hasAccess)
                put("granted", hasAccess)
                put("dndActive", hardwareActive)
                put("filterName", filterName)
                put("ringerMode", dndHelper.getRingerModeName())
            }.toString()
        } catch (e: Exception) {
            "{\"success\":false,\"granted\":false,\"dndActive\":false}"
        }
    }

    @JavascriptInterface
    fun syncZonesFromWeb(zonesJson: String): Boolean {
        return try {
            val arr = JSONArray(zonesJson)
            val parsed = mutableListOf<SilentZoneModel>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val id = obj.optString("id", "").trim()
                if (id.isEmpty()) continue
                parsed.add(
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
            syncManager.cacheAndRegisterZones(parsed)
            mainHandler.post { onStateChanged() }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed parsing zones from WebView bridge: ${e.message}", e)
            false
        }
    }

    @JavascriptInterface
    fun syncEmergencyConfig(configJson: String): Boolean {
        val ok = emergencyManager.syncFromJson(configJson)
        if (ok) {
            mainHandler.post { onStateChanged() }
        }
        return ok
    }

    @JavascriptInterface
    fun getEmergencyConfigJson(): String {
        return emergencyManager.toJson()
    }

    @JavascriptInterface
    fun triggerEmergencyTestRing(contactName: String?, phoneNumber: String?): Boolean {
        val played = dndHelper.playEmergencyTestRing(3200L)
        Log.i(TAG, "Hardware emergency test ring for ${contactName ?: "Emergency"} (${phoneNumber ?: ""}): played=$played")
        mainHandler.post { onStateChanged() }
        return played
    }
}

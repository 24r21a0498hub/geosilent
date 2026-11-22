package com.geosilent.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import com.google.android.material.switchmaterial.SwitchMaterial

class MainActivity : AppCompatActivity() {

    private lateinit var dndHelper: DndHelper
    private lateinit var syncManager: FirebaseSyncManager
    private lateinit var emergencyManager: EmergencyContactsManager

    private lateinit var tvTopDndPill: TextView
    private lateinit var btnTabDashboard: Button
    private lateinit var btnTabNative: Button
    private lateinit var containerWebDashboard: FrameLayout
    private lateinit var scrollNativeControls: ScrollView
    private lateinit var webViewDashboard: WebView

    private lateinit var tvDndBadge: TextView
    private lateinit var tvDndSubtext: TextView
    private lateinit var tvDeviceStatus: TextView
    private lateinit var etPairingCode: EditText
    private lateinit var btnSavePairing: Button
    private lateinit var switchMonitoring: SwitchMaterial
    private lateinit var cardAutoSetup: MaterialCardView
    private lateinit var btnAutoGrantAll: Button
    private lateinit var cardDndPerm: MaterialCardView
    private lateinit var cardLocPerm: MaterialCardView
    private lateinit var cardEmergencyPerm: MaterialCardView
    private lateinit var btnGrantDnd: Button
    private lateinit var btnGrantLoc: Button
    private lateinit var btnGrantEmergencyPerm: Button
    private lateinit var etEmergencyName: EditText
    private lateinit var etEmergencyPhone: EditText
    private lateinit var btnAddEmergencyNumber: Button
    private lateinit var btnTestEmergencyRing: Button
    private lateinit var tvEmergencyList: TextView
    private lateinit var btnTestMute: Button
    private lateinit var btnTestUnmute: Button

    private var isUpdatingSwitchUi = false
    private var autoChainOnboarding = false

    // Pending WebView geolocation request resolved automatically after OS grant
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val allRuntimePermissionsLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: hasForegroundLocation()
            val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
            if (fine || coarse) {
                pendingGeoCallback?.invoke(pendingGeoOrigin, true, true)
            } else {
                pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
            }
            pendingGeoOrigin = null
            pendingGeoCallback = null

            if (autoChainOnboarding) {
                continueInbuiltOnboardingChain()
            } else {
                autoStartMonitoringIfReady()
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val fine = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
            val coarse = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
            if (fine || coarse) {
                pendingGeoCallback?.invoke(pendingGeoOrigin, true, true)
                pendingGeoOrigin = null
                pendingGeoCallback = null
                requestBackgroundLocationIfNeeded()
            } else {
                pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
                pendingGeoOrigin = null
                pendingGeoCallback = null
                if (autoChainOnboarding) {
                    continueInbuiltOnboardingChain()
                }
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

    private val backgroundLocationLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
            if (autoChainOnboarding) {
                continueInbuiltOnboardingChain()
            } else {
                autoStartMonitoringIfReady()
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

    private val emergencyCallPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            if (autoChainOnboarding) {
                continueInbuiltOnboardingChain()
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

    private val batteryOptimizationLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { _ ->
            if (autoChainOnboarding) {
                continueInbuiltOnboardingChain()
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        dndHelper = DndHelper(this)
        syncManager = FirebaseSyncManager.getInstance(this)
        emergencyManager = EmergencyContactsManager.getInstance(this)

        initViews()
        setupWebDashboard()
        setupListeners()
        setupBackNavigation()

        autoStartMonitoringIfReady()
        maybePromptFirstLaunchPermissions()
    }

    override fun onResume() {
        super.onResume()
        autoChainOnboarding = false
        autoStartMonitoringIfReady()
        refreshUiState()
        notifyWebViewOfNativeStatus()
    }

    private fun maybePromptFirstLaunchPermissions() {
        val prefs = getSharedPreferences("smart_silent_prefs", Context.MODE_PRIVATE)
        val alreadyPrompted = prefs.getBoolean("shown_first_launch_permissions_v1", false)
        if (alreadyPrompted || hasAllRecommendedPermissions()) return

        prefs.edit().putBoolean("shown_first_launch_permissions_v1", true).apply()
        window.decorView.post {
            if (!isFinishing && !isDestroyed) {
                AlertDialog.Builder(this)
                    .setTitle("Allow All Permissions")
                    .setMessage(
                        "Smart Silent Zone needs a quick one-time setup with ZERO 3rd-party apps:\n\n" +
                            "• Location (All the time) — Automatic Classroom & Quiet Zone geofencing\n" +
                            "• Notifications & Battery — Reliable screen-locked monitoring\n" +
                            "• Phone & Call Log — Ring Emergency Contacts during DND\n" +
                            "• Inbuilt DND Access — Control phone ringer directly via Android OS"
                    )
                    .setPositiveButton("Allow All Permissions") { _, _ ->
                        startInbuiltOnboardingChain()
                    }
                    .setNegativeButton("Later", null)
                    .show()
            }
        }
    }

    private fun autoStartMonitoringIfReady() {
        if (!syncManager.wasManuallyPaused() && checkAllPermissionsGranted()) {
            if (!syncManager.isMonitoringEnabled()) {
                syncManager.setMonitoringEnabled(true)
            }
            GeofenceForegroundService.start(this)
            syncManager.startRealtimeSync()
        }
    }

    private fun initViews() {
        tvTopDndPill = findViewById(R.id.tvTopDndPill)
        btnTabDashboard = findViewById(R.id.btnTabDashboard)
        btnTabNative = findViewById(R.id.btnTabNative)
        containerWebDashboard = findViewById(R.id.containerWebDashboard)
        scrollNativeControls = findViewById(R.id.scrollNativeControls)
        webViewDashboard = findViewById(R.id.webViewDashboard)

        tvDndBadge = findViewById(R.id.tvDndBadge)
        tvDndSubtext = findViewById(R.id.tvDndSubtext)
        tvDeviceStatus = findViewById(R.id.tvDeviceStatus)
        etPairingCode = findViewById(R.id.etPairingCode)
        btnSavePairing = findViewById(R.id.btnSavePairing)
        switchMonitoring = findViewById(R.id.switchMonitoring)
        cardAutoSetup = findViewById(R.id.cardAutoSetup)
        btnAutoGrantAll = findViewById(R.id.btnAutoGrantAll)
        cardDndPerm = findViewById(R.id.cardDndPerm)
        cardLocPerm = findViewById(R.id.cardLocPerm)
        cardEmergencyPerm = findViewById(R.id.cardEmergencyPerm)
        btnGrantDnd = findViewById(R.id.btnGrantDnd)
        btnGrantLoc = findViewById(R.id.btnGrantLoc)
        btnGrantEmergencyPerm = findViewById(R.id.btnGrantEmergencyPerm)
        etEmergencyName = findViewById(R.id.etEmergencyName)
        etEmergencyPhone = findViewById(R.id.etEmergencyPhone)
        btnAddEmergencyNumber = findViewById(R.id.btnAddEmergencyNumber)
        btnTestEmergencyRing = findViewById(R.id.btnTestEmergencyRing)
        tvEmergencyList = findViewById(R.id.tvEmergencyList)
        btnTestMute = findViewById(R.id.btnTestMute)
        btnTestUnmute = findViewById(R.id.btnTestUnmute)

        val currentCode = syncManager.getPairingCode()
        if (currentCode.isNotBlank()) {
            etPairingCode.setText(currentCode)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebDashboard() {
        val bridge = WebAppDndBridge(
            context = this,
            onRequestAllPermissions = { startInbuiltOnboardingChain() },
            onRequestLocationPermission = { requestForegroundLocation() },
            onRequestEmergencyPermissions = { requestEmergencyCallPermissions() },
            onRequestBatteryExemption = { requestBatteryOptimizationExemption() },
            onStateChanged = {
                refreshUiState()
                notifyWebViewOfNativeStatus()
            }
        )

        webViewDashboard.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
        }

        webViewDashboard.addJavascriptInterface(bridge, "AndroidNativeDnd")

        webViewDashboard.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                notifyWebViewOfNativeStatus()
            }
        }

        webViewDashboard.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                val hasFine = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                if (hasFine) {
                    callback?.invoke(origin, true, true)
                } else {
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    requestForegroundLocation()
                }
            }
        }

        val dashboardUrl = getString(R.string.dashboard_url)
        webViewDashboard.loadUrl(dashboardUrl)
    }

    private fun notifyWebViewOfNativeStatus() {
        val hasDnd = dndHelper.hasNotificationPolicyAccess()
        val active = dndHelper.isSilencedOnHardware()
        val hasLoc = hasForegroundLocation()
        val hasBgLoc = hasBackgroundLocation()
        val hasNotif = hasNotificationPermission()
        val hasBattery = hasBatteryOptimizationExemption()
        val hasEmerg = hasEmergencyCallPermissions()
        val js = "window.dispatchEvent(new CustomEvent('android-native-dnd-update',{detail:{granted:$hasDnd,dndActive:$active,locationGranted:$hasLoc,backgroundLocationGranted:$hasBgLoc,notificationsGranted:$hasNotif,batteryUnrestricted:$hasBattery,emergencyCallGranted:$hasEmerg}}));"
        webViewDashboard.evaluateJavascript(js, null)
    }

    private fun switchMainTab(showWebDashboard: Boolean) {
        if (showWebDashboard) {
            containerWebDashboard.visibility = View.VISIBLE
            scrollNativeControls.visibility = View.GONE
            btnTabDashboard.backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#4F46E5"))
            btnTabDashboard.setTextColor(Color.WHITE)
            btnTabNative.backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#1E293B"))
            btnTabNative.setTextColor(Color.parseColor("#CBD5E1"))
        } else {
            containerWebDashboard.visibility = View.GONE
            scrollNativeControls.visibility = View.VISIBLE
            btnTabNative.backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#4F46E5"))
            btnTabNative.setTextColor(Color.WHITE)
            btnTabDashboard.backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#1E293B"))
            btnTabDashboard.setTextColor(Color.parseColor("#CBD5E1"))
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (containerWebDashboard.visibility == View.VISIBLE && webViewDashboard.canGoBack()) {
                    webViewDashboard.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun setupListeners() {
        btnTabDashboard.setOnClickListener { switchMainTab(true) }
        btnTabNative.setOnClickListener { switchMainTab(false) }

        btnAutoGrantAll.setOnClickListener {
            startInbuiltOnboardingChain()
        }

        btnSavePairing.setOnClickListener {
            val code = etPairingCode.text.toString().trim()
            if (code.isBlank()) {
                Toast.makeText(this, "Please enter the pairing code from website", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            syncManager.setPairingCode(code)
            Toast.makeText(this, "Pairing code saved! Syncing with website...", Toast.LENGTH_SHORT).show()
            refreshUiState()
        }

        switchMonitoring.setOnCheckedChangeListener { _, isChecked ->
            if (isUpdatingSwitchUi) return@setOnCheckedChangeListener

            if (isChecked) {
                if (!checkAllPermissionsGranted()) {
                    setSwitchCheckedSafely(false)
                    syncManager.setMonitoringEnabled(false)
                    startInbuiltOnboardingChain()
                    return@setOnCheckedChangeListener
                }
                syncManager.setManuallyPaused(false)
                syncManager.setMonitoringEnabled(true)
                GeofenceForegroundService.start(this)
                syncManager.startRealtimeSync()
                Toast.makeText(this, "Smart Silent Zone monitoring started!", Toast.LENGTH_SHORT).show()
            } else {
                syncManager.setManuallyPaused(true)
                syncManager.setMonitoringEnabled(false)
                GeofenceForegroundService.stop(this)
                syncManager.stopSync()
                GeofenceManager(this).removeAllGeofences()
                Toast.makeText(this, "Monitoring stopped.", Toast.LENGTH_SHORT).show()
            }
            refreshUiState()
        }

        btnGrantDnd.setOnClickListener {
            Toast.makeText(this, "Toggle Smart Silent Zone ON to allow inbuilt DND access.", Toast.LENGTH_LONG).show()
            startActivity(dndHelper.getNotificationPolicyAccessIntent())
        }

        btnGrantLoc.setOnClickListener {
            requestForegroundLocation()
        }

        btnGrantEmergencyPerm.setOnClickListener {
            requestEmergencyCallPermissions()
        }

        btnAddEmergencyNumber.setOnClickListener {
            val name = etEmergencyName.text.toString().trim()
            val phone = etEmergencyPhone.text.toString().trim()
            val added = emergencyManager.addOrUpdateContact(name, phone, "Emergency")
            if (added == null) {
                Toast.makeText(this, "Enter a valid phone number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            etEmergencyName.setText("")
            etEmergencyPhone.setText("")
            Toast.makeText(this, "Added ${added.name} (${added.phone}) for DND breakthrough!", Toast.LENGTH_SHORT).show()
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

        btnTestEmergencyRing.setOnClickListener {
            val played = dndHelper.playEmergencyTestRing(3200L)
            Toast.makeText(
                this,
                if (played) "Ringing phone out loud (DND bypassed for test)..." else "Could not start ringtone test",
                Toast.LENGTH_SHORT
            ).show()
        }

        btnTestMute.setOnClickListener {
            if (dndHelper.activateForSilenceMode("silent") && dndHelper.isSilencedOnHardware()) {
                syncManager.setActiveZoneSilenceMode("silent")
                Toast.makeText(this, "Inbuilt Native DND Activated!", Toast.LENGTH_SHORT).show()
                syncManager.updateDeviceDndState(true, "Manual Test", dndHelper.getInterruptionFilterName())
            } else {
                Toast.makeText(this, "Grant Inbuilt DND Permission first", Toast.LENGTH_SHORT).show()
                startActivity(dndHelper.getNotificationPolicyAccessIntent())
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }

        btnTestUnmute.setOnClickListener {
            syncManager.setActiveZoneSilenceMode(null)
            if (dndHelper.deactivateDnd() && !dndHelper.isSilencedOnHardware()) {
                Toast.makeText(this, "Normal Mode Restored!", Toast.LENGTH_SHORT).show()
                syncManager.updateDeviceDndState(false, "", dndHelper.getInterruptionFilterName())
            } else {
                Toast.makeText(this, "Grant Inbuilt DND Permission first", Toast.LENGTH_SHORT).show()
            }
            refreshUiState()
            notifyWebViewOfNativeStatus()
        }
    }

    private var onboardingStepMask = 0

    private fun startInbuiltOnboardingChain() {
        autoChainOnboarding = true
        onboardingStepMask = 0
        continueInbuiltOnboardingChain()
    }

    private fun getMissingRuntimePermissions(): List<String> {
        val missing = mutableListOf<String>()
        if (!hasForegroundLocation()) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION)
            missing.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.READ_PHONE_STATE)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED
        ) {
            missing.add(Manifest.permission.READ_CALL_LOG)
        }
        return missing
    }

    private fun continueInbuiltOnboardingChain() {
        val missingRuntime = getMissingRuntimePermissions()
        if (missingRuntime.isNotEmpty() && (onboardingStepMask and 1) == 0) {
            onboardingStepMask = onboardingStepMask or 1
            allRuntimePermissionsLauncher.launch(missingRuntime.toTypedArray())
            return
        }
        if (hasForegroundLocation() && !hasBackgroundLocation() && (onboardingStepMask and 2) == 0) {
            onboardingStepMask = onboardingStepMask or 2
            requestBackgroundLocationIfNeeded()
            return
        }
        if (!hasBatteryOptimizationExemption() && (onboardingStepMask and 4) == 0) {
            onboardingStepMask = onboardingStepMask or 4
            requestBatteryOptimizationExemption()
            return
        }
        autoChainOnboarding = false
        if (!dndHelper.hasNotificationPolicyAccess()) {
            Toast.makeText(
                this,
                "Switch Smart Silent Zone ON to allow inbuilt DND Policy Access.",
                Toast.LENGTH_LONG
            ).show()
            startActivity(dndHelper.getNotificationPolicyAccessIntent())
        } else {
            autoStartMonitoringIfReady()
            refreshUiState()
            notifyWebViewOfNativeStatus()
            Toast.makeText(this, "All Location, Notification, DND & Emergency Ring permissions granted!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setSwitchCheckedSafely(checked: Boolean) {
        isUpdatingSwitchUi = true
        switchMonitoring.isChecked = checked
        isUpdatingSwitchUi = false
    }

    private fun refreshUiState() {
        val isSilenced = dndHelper.isSilencedOnHardware()
        val hasDndPerm = dndHelper.hasNotificationPolicyAccess()
        val filterName = dndHelper.getInterruptionFilterName()

        tvTopDndPill.text = when {
            !hasDndPerm -> "Inbuilt DND: Tap to Grant Access"
            isSilenced -> "Inbuilt DND: ACTIVE ($filterName)"
            else -> "Inbuilt DND: Ready (Normal Ringer)"
        }
        tvTopDndPill.setTextColor(
            when {
                !hasDndPerm -> Color.parseColor("#FBBF24")
                isSilenced -> Color.parseColor("#818CF8")
                else -> Color.parseColor("#34D399")
            }
        )

        if (isSilenced) {
            tvDndBadge.text = "DND ACTIVE"
            tvDndBadge.setBackgroundResource(R.drawable.badge_dnd_active)
            tvDndSubtext.text = "Inbuilt Android Filter: $filterName\nEmergency contacts can still ring out loud."
        } else {
            tvDndBadge.text = "NORMAL RINGER"
            tvDndBadge.setBackgroundResource(R.drawable.badge_dnd_normal)
            tvDndSubtext.text = "Inbuilt Android Filter: $filterName\nCalls and notifications ring normally."
        }

        val code = syncManager.getPairingCode()
        if (code.isNotBlank()) {
            tvDeviceStatus.text = "Standalone APK Ready • Paired Code: $code"
        } else {
            tvDeviceStatus.text = "Standalone APK Mode Active (Zero 3rd-party apps)"
        }

        val contacts = emergencyManager.getContacts()
        tvEmergencyList.text = if (contacts.isEmpty()) {
            "No emergency numbers added yet. Add numbers above or from App Map → Settings."
        } else {
            contacts.joinToString("\n") { "• ${it.name}: ${it.phone} (${it.relation})" }
        }

        val effectiveMonitoring = syncManager.isMonitoringEnabled() && checkAllPermissionsGranted()
        if (syncManager.isMonitoringEnabled() && !effectiveMonitoring) {
            syncManager.setMonitoringEnabled(false)
        }
        setSwitchCheckedSafely(effectiveMonitoring)

        updatePermissionCards()
        syncManager.publishDeviceTelemetry()
    }

    private fun updatePermissionCards() {
        val hasDnd = dndHelper.hasNotificationPolicyAccess()
        val hasLoc = hasForegroundLocation() && hasBackgroundLocation()
        val hasEmerg = hasEmergencyCallPermissions()

        cardAutoSetup.visibility = if (hasDnd && hasLoc && hasEmerg) View.GONE else View.VISIBLE
        cardDndPerm.visibility = if (hasDnd) View.GONE else View.VISIBLE
        cardLocPerm.visibility = if (hasLoc) View.GONE else View.VISIBLE
        cardEmergencyPerm.visibility = if (hasEmerg) View.GONE else View.VISIBLE
    }

    private fun hasForegroundLocation(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasBackgroundLocation(): Boolean {
        if (!hasForegroundLocation()) return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun hasEmergencyCallPermissions(): Boolean {
        val phoneState = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED
        val callLog = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        return phoneState && callLog
    }

    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun hasBatteryOptimizationExemption(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(packageName) ?: false
        } else {
            true
        }
    }

    private fun hasAllRecommendedPermissions(): Boolean {
        return dndHelper.hasNotificationPolicyAccess() &&
            hasForegroundLocation() &&
            hasBackgroundLocation() &&
            hasNotificationPermission() &&
            hasBatteryOptimizationExemption() &&
            hasEmergencyCallPermissions()
    }

    private fun checkAllPermissionsGranted(): Boolean {
        return dndHelper.hasNotificationPolicyAccess() && hasForegroundLocation()
    }

    private fun requestForegroundLocation() {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        locationPermissionLauncher.launch(perms.toTypedArray())
    }

    private fun requestBackgroundLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val bgGranted = hasBackgroundLocation()
            if (!bgGranted) {
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                return
            }
        }
        if (autoChainOnboarding) {
            continueInbuiltOnboardingChain()
        } else {
            autoStartMonitoringIfReady()
        }
    }

    private fun requestEmergencyCallPermissions() {
        val perms = mutableListOf(Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            perms.add(Manifest.permission.READ_CALL_LOG)
        }
        emergencyCallPermissionLauncher.launch(perms.toTypedArray())
    }

    @SuppressLint("BatteryLife")
    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !hasBatteryOptimizationExemption()) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                batteryOptimizationLauncher.launch(intent)
                return
            } catch (e: Exception) {
                try {
                    startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                } catch (_: Exception) {}
            }
        }
        if (autoChainOnboarding) {
            continueInbuiltOnboardingChain()
        }
    }
}

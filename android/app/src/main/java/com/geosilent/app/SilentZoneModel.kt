package com.geosilent.app

data class SilentZoneModel(
    val id: String = "",
    val name: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val radius: Float = 100f,
    val mode: String = "custom", // college, library, hospital, meeting, custom
    val silenceMode: String = "silent", // silent, priority, vibrate
    val enabled: Boolean = true
)

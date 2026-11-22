package com.geosilent.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class EmergencyContact(
    val id: String,
    val name: String,
    val phone: String,
    val relation: String = "Emergency"
)

data class BreakthroughMatch(
    val contactName: String,
    val phone: String,
    val isRepeatCaller: Boolean,
    val reason: String
)

/**
 * Manages emergency contact numbers, repeat-caller windows, and DND breakthrough state
 * locally inside private SharedPreferences so calls from saved emergency numbers
 * ring out loud even when DND or Vibrate mode is active.
 */
class EmergencyContactsManager private constructor(context: Context) {

    private val prefs = context.getSharedPreferences("smart_silent_zone_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val PREF_VIP_ENABLED = "emergency_vip_enabled"
        private const val PREF_REPEAT_CALLERS_ENABLED = "emergency_repeat_callers_enabled"
        private const val PREF_CONTACTS_JSON = "emergency_contacts_json"
        private const val PREF_RECENT_CALLS_JSON = "emergency_recent_calls_json"

        private const val PREF_BREAKTHROUGH_ACTIVE = "emergency_breakthrough_active"
        private const val PREF_BREAKTHROUGH_SAVED_FILTER = "emergency_breakthrough_saved_filter"
        private const val PREF_BREAKTHROUGH_SAVED_RINGER = "emergency_breakthrough_saved_ringer"
        private const val PREF_BREAKTHROUGH_SAVED_VOL = "emergency_breakthrough_saved_vol"
        private const val PREF_BREAKTHROUGH_ZONE_MODE = "emergency_breakthrough_zone_mode"

        private const val REPEAT_WINDOW_MS = 180_000L // 3 minutes

        @Volatile
        private var instance: EmergencyContactsManager? = null

        fun getInstance(context: Context): EmergencyContactsManager {
            return instance ?: synchronized(this) {
                instance ?: EmergencyContactsManager(context.applicationContext).also { instance = it }
            }
        }

        fun normalizeDigits(raw: String?): String {
            if (raw.isNullOrBlank()) return ""
            return raw.filter { it.isDigit() }
        }

        fun phoneNumbersMatch(savedRaw: String?, incomingRaw: String?): Boolean {
            val a = normalizeDigits(savedRaw)
            val b = normalizeDigits(incomingRaw)
            if (a.isEmpty() || b.isEmpty()) return false
            if (a == b) return true
            // Match country-code variants (e.g. +91 9876543210 vs 9876543210)
            if (a.length >= 7 && b.length >= 7) {
                val tailLen = minOf(10, minOf(a.length, b.length))
                return a.takeLast(tailLen) == b.takeLast(tailLen)
            }
            return false
        }
    }

    fun isVipContactsEnabled(): Boolean = prefs.getBoolean(PREF_VIP_ENABLED, true)

    fun isRepeatCallersEnabled(): Boolean = prefs.getBoolean(PREF_REPEAT_CALLERS_ENABLED, true)

    fun getContacts(): List<EmergencyContact> {
        val raw = prefs.getString(PREF_CONTACTS_JSON, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val list = mutableListOf<EmergencyContact>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val phone = obj.optString("phone", "").trim()
                if (phone.isEmpty()) continue
                list.add(
                    EmergencyContact(
                        id = obj.optString("id", "${System.currentTimeMillis()}_$i"),
                        name = obj.optString("name", "Emergency Contact").ifBlank { "Emergency Contact" },
                        phone = phone,
                        relation = obj.optString("relation", "Emergency")
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun saveConfig(vipEnabled: Boolean, repeatCallersEnabled: Boolean, contacts: List<EmergencyContact>) {
        val arr = JSONArray()
        contacts.forEach { c ->
            val cleanPhone = c.phone.trim()
            if (cleanPhone.isNotEmpty()) {
                arr.put(
                    JSONObject().apply {
                        put("id", c.id)
                        put("name", c.name.trim().ifBlank { "Emergency Contact" })
                        put("phone", cleanPhone)
                        put("relation", c.relation.trim().ifBlank { "Emergency" })
                    }
                )
            }
        }
        prefs.edit()
            .putBoolean(PREF_VIP_ENABLED, vipEnabled)
            .putBoolean(PREF_REPEAT_CALLERS_ENABLED, repeatCallersEnabled)
            .putString(PREF_CONTACTS_JSON, arr.toString())
            .apply()
    }

    fun addOrUpdateContact(name: String, phone: String, relation: String = "Emergency"): EmergencyContact? {
        val cleanPhone = phone.trim()
        if (normalizeDigits(cleanPhone).isEmpty()) return null
        val cleanName = name.trim().ifBlank { "Emergency" }
        val current = getContacts().toMutableList()
        val existingIdx = current.indexOfFirst { phoneNumbersMatch(it.phone, cleanPhone) }
        val contact = EmergencyContact(
            id = if (existingIdx >= 0) current[existingIdx].id else System.currentTimeMillis().toString(),
            name = cleanName,
            phone = cleanPhone,
            relation = relation.trim().ifBlank { "Emergency" }
        )
        if (existingIdx >= 0) {
            current[existingIdx] = contact
        } else {
            current.add(contact)
        }
        saveConfig(isVipContactsEnabled(), isRepeatCallersEnabled(), current)
        return contact
    }

    fun syncFromJson(configJson: String): Boolean {
        return try {
            val root = JSONObject(configJson)
            val vipEnabled = root.optBoolean("vipContactsEnabled", true)
            val repeatEnabled = root.optBoolean("repeatCallersEnabled", true)
            val arr = root.optJSONArray("contacts") ?: JSONArray()
            val list = mutableListOf<EmergencyContact>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val phone = obj.optString("phone", "").trim()
                if (normalizeDigits(phone).isEmpty()) continue
                list.add(
                    EmergencyContact(
                        id = obj.optString("id", "${System.currentTimeMillis()}_$i"),
                        name = obj.optString("name", "Emergency Contact"),
                        phone = phone,
                        relation = obj.optString("relation", "Emergency")
                    )
                )
            }
            saveConfig(vipEnabled, repeatEnabled, list)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun toJson(): String {
        val contacts = getContacts()
        val arr = JSONArray()
        contacts.forEach { c ->
            arr.put(
                JSONObject().apply {
                    put("id", c.id)
                    put("name", c.name)
                    put("phone", c.phone)
                    put("relation", c.relation)
                }
            )
        }
        return JSONObject().apply {
            put("vipContactsEnabled", isVipContactsEnabled())
            put("repeatCallersEnabled", isRepeatCallersEnabled())
            put("contacts", arr)
        }.toString()
    }

    /**
     * Evaluates an incoming phone number against saved emergency contacts and repeat caller rules.
     */
    fun evaluateIncomingCall(incomingNumber: String?): BreakthroughMatch? {
        if (incomingNumber.isNullOrBlank()) return null

        if (isVipContactsEnabled()) {
            val matched = getContacts().firstOrNull { phoneNumbersMatch(it.phone, incomingNumber) }
            if (matched != null) {
                return BreakthroughMatch(
                    contactName = matched.name,
                    phone = incomingNumber,
                    isRepeatCaller = false,
                    reason = "Saved Emergency Contact (${matched.relation})"
                )
            }
        }

        if (isRepeatCallersEnabled() && recordAndCheckRepeatCaller(incomingNumber)) {
            return BreakthroughMatch(
                contactName = incomingNumber,
                phone = incomingNumber,
                isRepeatCaller = true,
                reason = "Repeat Caller (2nd call within 3 minutes)"
            )
        }

        return null
    }

    private fun recordAndCheckRepeatCaller(incomingNumber: String): Boolean {
        val digits = normalizeDigits(incomingNumber)
        if (digits.isEmpty()) return false
        val key = if (digits.length > 10) digits.takeLast(10) else digits
        val now = System.currentTimeMillis()

        val raw = prefs.getString(PREF_RECENT_CALLS_JSON, "{}") ?: "{}"
        val map = try {
            JSONObject(raw)
        } catch (_: Exception) {
            JSONObject()
        }

        var isRepeat = false
        val prevTime = map.optLong(key, 0L)
        if (prevTime > 0L && (now - prevTime) in 2000L..REPEAT_WINDOW_MS) {
            isRepeat = true
        }

        // Prune stale timestamps and store current
        val cleaned = JSONObject()
        val keys = map.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            val ts = map.optLong(k, 0L)
            if (now - ts <= REPEAT_WINDOW_MS) {
                cleaned.put(k, ts)
            }
        }
        cleaned.put(key, now)
        prefs.edit().putString(PREF_RECENT_CALLS_JSON, cleaned.toString()).apply()

        return isRepeat
    }

    fun saveBreakthroughRestoreState(
        savedFilter: Int,
        savedRingerMode: Int,
        savedRingVolume: Int,
        activeZoneSilenceMode: String?
    ) {
        prefs.edit()
            .putBoolean(PREF_BREAKTHROUGH_ACTIVE, true)
            .putInt(PREF_BREAKTHROUGH_SAVED_FILTER, savedFilter)
            .putInt(PREF_BREAKTHROUGH_SAVED_RINGER, savedRingerMode)
            .putInt(PREF_BREAKTHROUGH_SAVED_VOL, savedRingVolume)
            .putString(PREF_BREAKTHROUGH_ZONE_MODE, activeZoneSilenceMode ?: "")
            .apply()
    }

    fun isBreakthroughActive(): Boolean = prefs.getBoolean(PREF_BREAKTHROUGH_ACTIVE, false)

    data class BreakthroughRestoreState(
        val savedFilter: Int,
        val savedRingerMode: Int,
        val savedRingVolume: Int,
        val activeZoneSilenceMode: String?
    )

    fun consumeBreakthroughRestoreState(): BreakthroughRestoreState? {
        if (!isBreakthroughActive()) return null
        val state = BreakthroughRestoreState(
            savedFilter = prefs.getInt(PREF_BREAKTHROUGH_SAVED_FILTER, 1),
            savedRingerMode = prefs.getInt(PREF_BREAKTHROUGH_SAVED_RINGER, 2),
            savedRingVolume = prefs.getInt(PREF_BREAKTHROUGH_SAVED_VOL, 5),
            activeZoneSilenceMode = prefs.getString(PREF_BREAKTHROUGH_ZONE_MODE, null)?.takeIf { it.isNotBlank() }
        )
        prefs.edit().putBoolean(PREF_BREAKTHROUGH_ACTIVE, false).apply()
        return state
    }
}

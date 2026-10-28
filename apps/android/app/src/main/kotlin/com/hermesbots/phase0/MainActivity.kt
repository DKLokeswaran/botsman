package com.hermesbots.phase0

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

class MainActivity : ComponentActivity() {
    private val model: Phase0Model by viewModels {
        object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                @Suppress("UNCHECKED_CAST")
                return Phase0Model(application) as T
            }
        }
    }

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) model.readUri(this, uri, "image", imageOnly = false)
    }
    private val pickFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.readUri(this, uri, "file", imageOnly = false)
    }
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33 && !notificationPermissionGranted(this)) {
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        deliverPush(intent)
        setContent {
            val state by model.state.collectAsState()
            ZoetrikTheme {
                Phase0Screen(
                    state = state,
                    onServer = { model.update(serverUrl = it) },
                    onUsername = { model.update(username = it) },
                    onPassword = { model.update(password = it) },
                    onLogin = model::login,
                    onOpen = model::openSession,
                    onNew = model::newSession,
                    onDraft = { model.update(draft = it) },
                    onSend = model::send,
                    onAllow = { model.answer("once") },
                    onDeny = { model.answer("deny") },
                    onToggleCommand = model::toggleCommand,
                    onIme = { model.update(ime = it) },
                    onPaste = { model.pasteClipboard(this) },
                    onPickImage = { pickImage.launch("image/*") },
                    onPickFile = { pickFile.launch(arrayOf("*/*")) },
                    onRegisterPush = { registerUnifiedPush(this) },
                    onUpdateBase = { model.update(updateBase = it) },
                    onCheckUpdate = model::checkForUpdate,
                    onApplyUpdate = { model.applyUpdate(this) },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        deliverPush(intent)
    }

    private fun deliverPush(intent: Intent?) {
        val json = intent?.getStringExtra("push_json")
        if (json != null) {
            model.notePush(json, intent.getStringExtra("push_action"))
            return
        }
        intent?.getStringExtra("push_body")?.let { model.notePush(it) }
    }

    override fun onStart() {
        super.onStart()
        if (notificationPermissionGranted(this)) {
            registerUnifiedPush(this)
        }
        model.onForeground()
    }
}

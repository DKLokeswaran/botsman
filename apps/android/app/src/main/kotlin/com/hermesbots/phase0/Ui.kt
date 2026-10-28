package com.hermesbots.phase0

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.m3.Markdown

@Composable
fun Phase0Screen(
    state: Phase0State,
    onServer: (String) -> Unit,
    onUsername: (String) -> Unit,
    onPassword: (String) -> Unit,
    onLogin: () -> Unit,
    onOpen: (String) -> Unit,
    onNew: () -> Unit,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    onAllow: () -> Unit,
    onDeny: () -> Unit,
    onToggleCommand: () -> Unit,
    onIme: (String) -> Unit,
    onPaste: () -> Unit,
    onPickImage: () -> Unit,
    onPickFile: () -> Unit,
    onRegisterPush: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(scheme.background)
            .windowInsetsPadding(WindowInsets.safeDrawing.union(WindowInsets.ime))
            .padding(horizontal = 16.dp),
    ) {
        Text("HERMES BOTS", style = MaterialTheme.typography.headlineMedium, color = scheme.onBackground, modifier = Modifier.padding(top = 12.dp))
        Text(state.status.uppercase(), style = MaterialTheme.typography.labelMedium, color = scheme.primary, modifier = Modifier.padding(bottom = 8.dp))
        if (state.reconnecting) {
            Text(
                "RECONNECTING",
                modifier = Modifier.fillMaxWidth().background(scheme.primary).padding(8.dp),
                color = scheme.onPrimary,
                style = MaterialTheme.typography.labelMedium,
            )
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!state.connected) {
                LoginBlock(state, onServer, onUsername, onPassword, onLogin, onRegisterPush)
            } else {
                ChatBlock(state, onOpen, onNew, onAllow, onDeny, onToggleCommand)
            }
        }
        if (state.connected) {
            Composer(state, onDraft, onSend, onPaste, onPickImage, onPickFile)
        }
        Text("IME", style = MaterialTheme.typography.labelMedium, color = scheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        OutlinedTextField(
            value = state.ime,
            onValueChange = onIme,
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            label = { Text("Try Tamil and Hindi typing here") },
            minLines = 1,
        )
    }
}

@Composable
private fun LoginBlock(
    state: Phase0State,
    onServer: (String) -> Unit,
    onUsername: (String) -> Unit,
    onPassword: (String) -> Unit,
    onLogin: () -> Unit,
    onRegisterPush: () -> Unit,
) {
    OutlinedTextField(state.serverUrl, onServer, Modifier.fillMaxWidth(), label = { Text("Hermes server") }, singleLine = true)
    OutlinedTextField(state.username, onUsername, Modifier.fillMaxWidth(), label = { Text("Username") }, singleLine = true)
    OutlinedTextField(state.password, onPassword, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Slab("Log in", onLogin)
        Slab("Register push", onRegisterPush)
    }
    Text(state.pushStatus, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (state.pushEndpoint.isNotEmpty()) {
        Text(state.pushEndpoint, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FragmentMono), color = Color(0xFF71FF19))
    }
    if (state.pushBody.isNotEmpty()) {
        Text("Opened from notification: ${state.pushBody}", color = MaterialTheme.colorScheme.onBackground)
    }
}

@Composable
private fun ChatBlock(
    state: Phase0State,
    onOpen: (String) -> Unit,
    onNew: () -> Unit,
    onAllow: () -> Unit,
    onDeny: () -> Unit,
    onToggleCommand: () -> Unit,
) {
    Text("PROFILES", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
    state.profiles.forEach { profile ->
        Text("${profile.displayName}  ${profile.model}", color = MaterialTheme.colorScheme.onBackground)
        if (profile.description.isNotEmpty()) {
            Text(profile.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
    Text("SESSIONS", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Slab("New session", onNew)
    }
    state.sessions.forEach { session ->
        Slab(session.title.ifEmpty { session.id }, { onOpen(session.id) })
    }
    state.approval?.let { card ->
        Column(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.primary).padding(12.dp)) {
            Text("NEEDS YOU", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(card.description, color = MaterialTheme.colorScheme.onBackground)
            if (state.showCommand) {
                Text(card.command, fontFamily = FragmentMono, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Slab("Allow once", onAllow)
                Slab("Deny", onDeny)
                Slab(if (state.showCommand) "Hide command" else "Full command", onToggleCommand)
            }
        }
    }
    state.messages.forEach { line ->
        Text(line.role.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (line.role == "assistant") {
            Markdown(line.text.ifEmpty { "…" })
        } else {
            Text(line.text, color = if (line.role == "error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground)
        }
    }
}

@Composable
private fun Composer(
    state: Phase0State,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    onPaste: () -> Unit,
    onPickImage: () -> Unit,
    onPickFile: () -> Unit,
) {
    state.staged.forEach { file ->
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            file.image?.let { Image(it, contentDescription = file.name, modifier = Modifier.size(72.dp)) }
            Text(file.name, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    OutlinedTextField(
        value = state.draft,
        onValueChange = onDraft,
        modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp).padding(top = 8.dp),
        label = { Text("Message") },
    )
    Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Slab("Send", onSend)
        Slab("Paste image", onPaste)
        Slab("Image", onPickImage)
        Slab("File", onPickFile)
    }
}

@Composable
private fun Slab(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = MaterialTheme.shapes.extraSmall,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelMedium)
    }
}

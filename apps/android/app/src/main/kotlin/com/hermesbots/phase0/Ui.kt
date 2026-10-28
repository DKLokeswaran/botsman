package com.hermesbots.phase0

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.compose.elements.MarkdownCodeBlock
import com.mikepenz.markdown.compose.elements.MarkdownCodeFence
import com.mikepenz.markdown.compose.elements.MarkdownListItems
import com.mikepenz.markdown.compose.elements.listDepth
import com.mikepenz.markdown.m3.Markdown
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private suspend fun androidx.compose.foundation.ScrollState.scrollToBottomWhenReady() {
    if (maxValue > 0) {
        scrollTo(maxValue)
        return
    }
    snapshotFlow { maxValue }.filter { it > 0 }.first()
    scrollTo(maxValue)
}

@Composable
fun Phase0Screen(
    state: Phase0State,
    onServer: (String) -> Unit = {},
    onUsername: (String) -> Unit = {},
    onPassword: (String) -> Unit = {},
    onLogin: () -> Unit = {},
    onOpen: (String) -> Unit = {},
    onNew: () -> Unit = {},
    onDraft: (String) -> Unit = {},
    onSend: () -> Unit = {},
    onAllow: () -> Unit = {},
    onDeny: () -> Unit = {},
    onToggleCommand: () -> Unit = {},
    onIme: (String) -> Unit = {},
    onPaste: () -> Unit = {},
    onPickImage: () -> Unit = {},
    onPickFile: () -> Unit = {},
    onRegisterPush: () -> Unit = {},
    onUpdateBase: (String) -> Unit = {},
    onCheckUpdate: () -> Unit = {},
    onApplyUpdate: () -> Unit = {},
) {
    val scheme = MaterialTheme.colorScheme
    val density = LocalDensity.current
    val scrollState = rememberScrollState()
    var showJumpToLatest by remember { mutableStateOf(false) }
    val stickDp = remember { intArrayOf(0) }
    var viewportHeight by remember { mutableIntStateOf(0) }
    var openedSession by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val messages = state.messages
    val focusTarget = state.focus?.target
    val memory = remember {
        object {
            var session: String? = null
            var count = 0
            var text = ""
        }
    }

    LaunchedEffect(scrollState, density) {
        var lastValue = scrollState.value
        snapshotFlow { scrollState.value to scrollState.maxValue }.collect { (value, max) ->
            val dist = distanceDp((max - value).coerceAtLeast(0), density.density)
            if (value != lastValue) {
                lastValue = value
                stickDp[0] = dist
                showJumpToLatest = shouldShowJumpToLatest(dist)
            } else if (!shouldShowJumpToLatest(dist)) {
                stickDp[0] = dist
                showJumpToLatest = false
            }
        }
    }

    LaunchedEffect(messages.size, messages.lastOrNull()?.text, messages.lastOrNull()?.role, state.liveSessionId, focusTarget) {
        val last = messages.lastOrNull()
        val lastRole = last?.role.orEmpty()
        val lastText = last?.text.orEmpty()
        if (memory.session != state.liveSessionId) {
            memory.session = state.liveSessionId
            memory.count = messages.size
            memory.text = lastText
            return@LaunchedEffect
        }
        val deepLinked = focusTarget == "message" || focusTarget == "approval" || focusTarget == "question"
        if (deepLinked && messages.size > memory.count + 1) {
            memory.count = messages.size
            memory.text = lastText
            stickDp[0] = distanceDp((scrollState.maxValue - scrollState.value).coerceAtLeast(0), density.density)
            showJumpToLatest = shouldShowJumpToLatest(stickDp[0])
            return@LaunchedEffect
        }
        val event = classifyScrollEvent(memory.count, memory.text, messages.size, lastRole, lastText)
        memory.count = messages.size
        memory.text = lastText
        if (event == null) {
            return@LaunchedEffect
        }
        if (shouldFollow(stickDp[0], event)) {
            scrollState.scrollToBottomWhenReady()
            stickDp[0] = 0
            showJumpToLatest = false
        } else if (event == ChatScrollEvent.REPLY_STREAM) {
            showJumpToLatest = shouldShowJumpToLatest(stickDp[0])
        }
    }

    LaunchedEffect(state.liveSessionId, messages.size, scrollState.maxValue, focusTarget, viewportHeight) {
        val session = state.liveSessionId ?: return@LaunchedEffect
        if (openedSession == session) {
            return@LaunchedEffect
        }
        val deepLinked = focusTarget == "message" || focusTarget == "approval" || focusTarget == "question"
        if (deepLinked) {
            if (viewportHeight == 0) {
                stickDp[0] = NEAR_BOTTOM_DP + 1
                return@LaunchedEffect
            }
            val dist = distanceDp((scrollState.maxValue - scrollState.value).coerceAtLeast(0), density.density)
            stickDp[0] = dist
            showJumpToLatest = shouldShowJumpToLatest(dist)
            openedSession = session
            return@LaunchedEffect
        }
        if (scrollState.maxValue <= 0) {
            return@LaunchedEffect
        }
        scrollState.scrollTo(scrollState.maxValue)
        stickDp[0] = 0
        showJumpToLatest = false
        openedSession = session
    }

    LaunchedEffect(viewportHeight, openedSession) {
        if (viewportHeight == 0 || openedSession == null) {
            return@LaunchedEffect
        }
        if (shouldFollow(stickDp[0], ChatScrollEvent.REPLY_STREAM)) {
            scrollState.scrollTo(scrollState.maxValue)
            stickDp[0] = 0
            showJumpToLatest = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(scheme.background)
            .windowInsetsPadding(WindowInsets.safeDrawing.union(WindowInsets.ime))
            .padding(horizontal = 16.dp),
    ) {
        Text("HERMES BOTS", style = MaterialTheme.typography.headlineMedium, color = scheme.onBackground, modifier = Modifier.padding(top = 12.dp))
        Text(state.status.uppercase(), style = MaterialTheme.typography.labelMedium, color = scheme.primary)
        Text(state.appVersion, style = MaterialTheme.typography.bodyMedium, color = scheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
        if (state.reconnecting) {
            Text(
                "RECONNECTING",
                modifier = Modifier.fillMaxWidth().background(scheme.primary).padding(8.dp),
                color = scheme.onPrimary,
                style = MaterialTheme.typography.labelMedium,
            )
        }
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .onSizeChanged { viewportHeight = it.height },
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (!state.connected) {
                    LoginBlock(state, onServer, onUpdateBase, onUsername, onPassword, onLogin, onRegisterPush)
                } else {
                    ChatBlock(state, onOpen, onNew, onAllow, onDeny, onToggleCommand)
                }
            }
            if (showJumpToLatest) {
                Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp)) {
                    Slab("Jump to latest") {
                        showJumpToLatest = false
                        stickDp[0] = 0
                        scope.launch { scrollState.scrollToBottomWhenReady() }
                    }
                }
            }
        }
        if (state.connected) {
            Composer(state, onDraft, onSend, onPaste, onPickImage, onPickFile)
        }
        AboutBlock(state, onUpdateBase, onCheckUpdate, onApplyUpdate)
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
    onUpdateBase: (String) -> Unit,
    onUsername: (String) -> Unit,
    onPassword: (String) -> Unit,
    onLogin: () -> Unit,
    onRegisterPush: () -> Unit,
) {
    OutlinedTextField(state.serverUrl, onServer, Modifier.fillMaxWidth(), label = { Text("Hermes server") }, singleLine = true)
    OutlinedTextField(state.updateBase, onUpdateBase, Modifier.fillMaxWidth(), label = { Text("Update server") }, singleLine = true)
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
    state.messages.forEachIndexed { index, line ->
        key(index, line.messageId, line.role) {
            val focus = state.focus
            val landed = focus?.target == "message" && (
                focus.messageIndex == index ||
                    (focus.messageId.isNotEmpty() && line.messageId.isNotEmpty() && focus.messageId == line.messageId) ||
                    (focus.seq != null && focus.seq == line.seq)
                )
            val bring = remember(index, line.messageId, line.seq) { BringIntoViewRequester() }
            LaunchedEffect(landed) {
                if (landed) bring.bringIntoView()
            }
            Column(
                Modifier
                    .bringIntoViewRequester(bring)
                    .fillMaxWidth()
                    .then(if (landed) Modifier.border(2.dp, MaterialTheme.colorScheme.primary).padding(8.dp) else Modifier),
            ) {
                Text(line.role.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                when (line.role) {
                    "assistant" -> ReplyMarkdown(line.text)
                    "user" -> UserMessage(line.text)
                    else -> Text(line.text, color = if (line.role == "error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground)
                }
            }
        }
    }
    state.approval?.let { card ->
        val focus = state.focus
        val landed = focus?.target == "approval" && (
            focus.requestId.isEmpty() || focus.requestId == card.requestId || focus.requestId == card.id
            )
        val bring = remember(card.id) { BringIntoViewRequester() }
        LaunchedEffect(card.id, card.resolvedLabel) { bring.bringIntoView() }
        LaunchedEffect(landed) {
            if (landed) bring.bringIntoView()
        }
        Column(
            Modifier
                .bringIntoViewRequester(bring)
                .fillMaxWidth()
                .border(if (landed) 2.dp else 1.dp, MaterialTheme.colorScheme.primary)
                .padding(12.dp),
        ) {
            Text("NEEDS YOU", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(card.description, color = MaterialTheme.colorScheme.onBackground)
            if (card.resolvedLabel != null) {
                Text(card.resolvedLabel.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
            } else {
                if (state.showCommand) {
                    Text(card.command, fontFamily = FragmentMono, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Slab("Allow once", onAllow)
                    Slab("Deny", onDeny)
                    Slab(if (state.showCommand) "Hide command" else "Full command", onToggleCommand)
                }
            }
        }
    }
    state.question?.let { card ->
        val focus = state.focus
        val landed = focus?.target == "question" && (
            focus.requestId.isEmpty() || focus.requestId == card.requestId || focus.requestId == card.id
            )
        val bring = remember(card.id) { BringIntoViewRequester() }
        LaunchedEffect(card.id, card.resolvedLabel) { bring.bringIntoView() }
        LaunchedEffect(landed) {
            if (landed) bring.bringIntoView()
        }
        Column(
            Modifier
                .bringIntoViewRequester(bring)
                .fillMaxWidth()
                .border(if (landed) 2.dp else 1.dp, MaterialTheme.colorScheme.primary)
                .padding(12.dp),
        ) {
            Text("QUESTION", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(card.text, color = MaterialTheme.colorScheme.onBackground)
            card.resolvedLabel?.let { label ->
                Text(label.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
            }
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
    var menu by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box {
            IconButton(onClick = { menu = true }, modifier = Modifier.size(40.dp)) {
                Icon(AttachIcon, contentDescription = "Attach", tint = MaterialTheme.colorScheme.onSurface)
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(text = { Text("Image") }, onClick = { menu = false; onPickImage() })
                DropdownMenuItem(text = { Text("File") }, onClick = { menu = false; onPickFile() })
                DropdownMenuItem(text = { Text("Paste image") }, onClick = { menu = false; onPaste() })
            }
        }
        OutlinedTextField(
            value = state.draft,
            onValueChange = onDraft,
            modifier = Modifier.weight(1f).defaultMinSize(minWidth = 0.dp),
            placeholder = { Text("Message") },
            minLines = 1,
            maxLines = 4,
        )
        IconButton(onClick = onSend, modifier = Modifier.size(40.dp)) {
            Icon(SendIcon, contentDescription = "Send", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun ReplyMarkdown(text: String) {
    val primary = MaterialTheme.colorScheme.primary
    val components = markdownComponents(
        unorderedList = { model ->
            MarkdownListItems(model.content, model.node, depth = model.listDepth) { _, _, _ ->
                Text("•", color = primary, modifier = Modifier.padding(end = 8.dp))
            }
        },
        orderedList = { model ->
            MarkdownListItems(model.content, model.node, depth = model.listDepth) { index, listNumber, _ ->
                Text("${listNumber + index}.", color = primary, modifier = Modifier.padding(end = 8.dp))
            }
        },
        codeFence = { model ->
            MarkdownCodeFence(model.content, model.node, style = model.typography.code) { code, language, style ->
                CodeCard(code.trimEnd(), language?.takeIf { it.isNotBlank() } ?: "text", style)
            }
        },
        codeBlock = { model ->
            MarkdownCodeBlock(model.content, model.node, style = model.typography.code) { code, language, style ->
                CodeCard(code.trimEnd(), language?.takeIf { it.isNotBlank() } ?: "text", style)
            }
        },
    )
    Markdown(text.ifEmpty { "…" }, components = components)
}

@Composable
private fun CodeCard(code: String, language: String, style: TextStyle) {
    var copied by remember(code) { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            delay(1500)
            copied = false
        }
    }
    @Suppress("DEPRECATION")
    val clipboard = LocalClipboardManager.current
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).background(MaterialTheme.colorScheme.surfaceVariant)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(language, fontFamily = FragmentMono, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            TextButton(onClick = {
                clipboard.setText(AnnotatedString(code))
                copied = true
            }) {
                Text(if (copied) "Copied" else "Copy", style = MaterialTheme.typography.labelMedium)
            }
        }
        Text(
            highlightCode(code),
            modifier = Modifier.horizontalScroll(rememberScrollState()).padding(8.dp),
            style = style.copy(fontFamily = FragmentMono, color = MaterialTheme.colorScheme.onBackground),
        )
    }
}

@Composable
private fun UserMessage(text: String) {
    var expanded by remember(text) { mutableStateOf(false) }
    var overflow by remember(text) { mutableStateOf(false) }
    Text(
        text,
        color = MaterialTheme.colorScheme.onBackground,
        maxLines = if (expanded) Int.MAX_VALUE else 6,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { result ->
            if (!expanded) overflow = result.hasVisualOverflow
        },
    )
    if (overflow || expanded) {
        TextButton(onClick = { expanded = !expanded }) {
            Text(if (expanded) "Show less" else "Show more", style = MaterialTheme.typography.labelMedium)
        }
    }
}

private val KEYWORDS = setOf(
    "const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "import", "from", "export",
    "def", "elif", "None", "True", "False", "async", "await", "echo", "cd", "fi", "then", "do", "done",
)

private fun highlightCode(code: String): AnnotatedString {
    val keyword = SpanStyle(color = Color(0xFFFFA41C))
    val string = SpanStyle(color = Color(0xFF71FF19))
    val comment = SpanStyle(color = Color(0xFF999999))
    val number = SpanStyle(color = Color(0xFF7DD3FC))
    return buildAnnotatedString {
        var index = 0
        while (index < code.length) {
            val rest = code.substring(index)
            when {
                rest.startsWith("//") || rest.startsWith("#") -> {
                    val end = code.indexOf('\n', index).let { if (it < 0) code.length else it }
                    withStyle(comment) { append(code.substring(index, end)) }
                    index = end
                }
                code[index] == '"' || code[index] == '\'' -> {
                    val quote = code[index]
                    var end = index + 1
                    while (end < code.length && code[end] != quote && code[end] != '\n') {
                        if (code[end] == '\\' && end + 1 < code.length) end += 1
                        end += 1
                    }
                    if (end < code.length && code[end] == quote) end += 1
                    withStyle(string) { append(code.substring(index, end)) }
                    index = end
                }
                code[index].isDigit() -> {
                    var end = index + 1
                    while (end < code.length && (code[end].isDigit() || code[end] == '.')) end += 1
                    withStyle(number) { append(code.substring(index, end)) }
                    index = end
                }
                code[index].isLetter() || code[index] == '_' -> {
                    var end = index + 1
                    while (end < code.length && (code[end].isLetterOrDigit() || code[end] == '_')) end += 1
                    val word = code.substring(index, end)
                    if (word in KEYWORDS) withStyle(keyword) { append(word) } else append(word)
                    index = end
                }
                else -> {
                    append(code[index])
                    index += 1
                }
            }
        }
    }
}

private fun glyph(path: String): ImageVector {
    return ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
        addPath(pathData = PathParser().parsePathString(path).toNodes(), fill = SolidColor(Color.Black))
    }.build()
}

private val AttachIcon = glyph("M16.5,6v11.5c0,2.21 -1.79,4 -4,4s-4,-1.79 -4,-4V5c0,-1.38 1.12,-2.5 2.5,-2.5s2.5,1.12 2.5,2.5v10.5c0,0.55 -0.45,1 -1,1s-1,-0.45 -1,-1V6H10v9.5c0,1.38 1.12,2.5 2.5,2.5s2.5,-1.12 2.5,-2.5V5c0,-2.21 -1.79,-4 -4,-4S7,2.79 7,5v12.5c0,3.04 2.46,5.5 5.5,5.5s5.5,-2.46 5.5,-5.5V6H16.5z")
private val SendIcon = glyph("M2.01,21L23,12 2.01,3 2,10l15,2 -15,2z")

@Composable
private fun AboutBlock(
    state: Phase0State,
    onUpdateBase: (String) -> Unit,
    onCheckUpdate: () -> Unit,
    onApplyUpdate: () -> Unit,
) {
    Text("ABOUT", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
    Text(state.appVersion, color = MaterialTheme.colorScheme.onBackground)
    if (state.connected) {
        OutlinedTextField(state.updateBase, onUpdateBase, Modifier.fillMaxWidth(), label = { Text("Update server") }, singleLine = true)
    }
    when (state.updatePhase) {
        "available" -> Text("Update available: ${state.updateVersion}", color = MaterialTheme.colorScheme.onBackground)
        "working" -> Text(state.updateDetail.ifBlank { "Downloading the update" }, color = MaterialTheme.colorScheme.onSurfaceVariant)
        "checking" -> Text("Checking for updates", color = MaterialTheme.colorScheme.onSurfaceVariant)
        "error" -> Text(state.updateDetail, color = MaterialTheme.colorScheme.error)
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        when (state.updatePhase) {
            "available", "working" -> Slab("Update", onApplyUpdate)
            "current" -> Slab("Up to date") {}
        }
        Slab("Check for updates", onCheckUpdate)
    }
    if (state.updatePhase == "available" && state.updateDetail.isNotEmpty()) {
        Text(state.updateDetail, color = MaterialTheme.colorScheme.error)
    }
}

@Composable
private fun Slab(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = MaterialTheme.shapes.extraSmall,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.tertiary,
            contentColor = MaterialTheme.colorScheme.onTertiary,
        ),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelMedium)
    }
}

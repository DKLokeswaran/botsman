package com.hermesbots.phase0

import org.intellij.markdown.MarkdownTokenTypes
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.ast.findChildOfType
import org.intellij.markdown.ast.getTextInNode

internal const val FENCE_COPY_LABEL = "Copy"
internal const val FENCE_COPIED_LABEL = "Copied"
internal const val FENCE_DEFAULT_LANGUAGE = "text"

internal data class FenceCard(val label: String, val text: String)

private val fenceLanguage = Regex("""[\w#+.-]+""")

internal fun fenceCard(content: String, node: ASTNode): FenceCard {
    val raw = node.findChildOfType(MarkdownTokenTypes.FENCE_LANG)?.getTextInNode(content)?.toString()
    return FenceCard(fenceLabel(raw), fenceBody(content, node))
}

internal fun fenceLabel(raw: String?): String {
    if (raw == null) return FENCE_DEFAULT_LANGUAGE
    val trimmed = raw.trimStart()
    val match = fenceLanguage.find(trimmed) ?: return FENCE_DEFAULT_LANGUAGE
    if (match.range.first != 0) return FENCE_DEFAULT_LANGUAGE
    return match.value.ifEmpty { FENCE_DEFAULT_LANGUAGE }
}

internal fun fenceBody(content: String, node: ASTNode): String {
    val children = node.children
    val openEol = children.indexOfFirst { it.type == MarkdownTokenTypes.EOL }
    if (openEol < 0) return ""
    val close = children.indexOfLast { it.type == MarkdownTokenTypes.CODE_FENCE_END }
    val start = children[openEol].endOffset
    val end = if (close > openEol) children[close].startOffset else node.endOffset
    if (end < start) return ""
    val body = content.substring(start, end).replace("\r\n", "\n").replace("\r", "\n")
    return if (body.endsWith("\n")) body.dropLast(1) else body
}

package com.hermesbots.phase0

import org.intellij.markdown.MarkdownElementTypes
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
import org.intellij.markdown.parser.CancellationToken
import org.intellij.markdown.parser.MarkdownParser
import org.junit.Assert.assertEquals
import org.junit.Test

class WindowsOneLineCodeblockAndroidParityTest {
    @Test
    fun test_bug_windows_one_line_codeblock_android_parity() {
        assertEquals(FENCE_COPY_LABEL, "Copy")
        assertEquals(FENCE_COPIED_LABEL, "Copied")
        assertEquals(FENCE_DEFAULT_LANGUAGE, "text")

        assertFence("```\necho \"hello\"\n```", "text", "echo \"hello\"")
        assertFence("```bash\necho \"hello\"\n```", "bash", "echo \"hello\"")
        assertFence("```Bash\necho \"hello\"\n```", "Bash", "echo \"hello\"")
        assertFence("```python\nprint(1)\nprint(2)\n```", "python", "print(1)\nprint(2)")
        assertFence("```\nline1\nline2\n```", "text", "line1\nline2")
        assertFence("```\necho hello\n\n```", "text", "echo hello\n")
        assertFence("```bash\necho hello\n\n```", "bash", "echo hello\n")
        assertFence("```\n\necho hello\n```", "text", "\necho hello")
        assertFence("```bash\n\necho hello\n```", "bash", "\necho hello")
        assertFence("```\necho a\n\necho b\n```", "text", "echo a\n\necho b")
        assertFence("```\n\n```", "text", "")
        assertFence("```\n\n\n```", "text", "\n")
        assertFence("```\n```", "text", "")
        assertFence("```bash\n```", "bash", "")
        assertFence("```\n   \n```", "text", "   ")
        assertFence("```\necho hello   \n```", "text", "echo hello   ")
        assertFence("```\n    echo hello\n```", "text", "    echo hello")
        assertFence("```notalang\nfoo()\n```", "notalang", "foo()")
        assertFence("```NoTaLang\nfoo()\n```", "NoTaLang", "foo()")
        assertFence("```python title\nprint(1)\n```", "python", "print(1)")
        assertFence("``` bash\necho hi\n```", "bash", "echo hi")
        assertFence("```!!!python\nfoo\n```", "text", "foo")
        assertFence("```c#\nfoo\n```", "c#", "foo")
        assertFence("```c++\nfoo\n```", "c++", "foo")
        assertFence("```text\nhello\n```", "text", "hello")
        assertFence("```   \nhello\n```", "text", "hello")
        assertFence("~~~\necho hi\n~~~", "text", "echo hi")
        assertFence("```\r\necho \"hello\"\r\n```", "text", "echo \"hello\"")
        assertFence("```bash\r\necho hi\r\n```", "bash", "echo hi")

        assertEquals(emptyList<FenceCard>(), cards("Use `npm test` here."))
        assertEquals(listOf("npm test"), inlineBodies("Use `npm test` here."))
        assertEquals(emptyList<FenceCard>(), cards("Use ```npm test``` here."))
        assertEquals(listOf("npm test"), inlineBodies("Use ```npm test``` here."))
    }

    private fun assertFence(markdown: String, label: String, text: String) {
        assertEquals(listOf(FenceCard(label, text)), cards(markdown))
    }

    private fun cards(markdown: String): List<FenceCard> {
        val found = mutableListOf<FenceCard>()
        walk(parse(markdown)) { node ->
            if (node.type == MarkdownElementTypes.CODE_FENCE) found += fenceCard(markdown, node)
        }
        return found
    }

    private fun inlineBodies(markdown: String): List<String> {
        val found = mutableListOf<String>()
        walk(parse(markdown)) { node ->
            if (node.type == MarkdownElementTypes.CODE_SPAN) {
                val raw = markdown.substring(node.startOffset, node.endOffset)
                val ticks = raw.takeWhile { it == '`' }
                found += if (ticks.isNotEmpty() && raw.endsWith(ticks)) {
                    raw.removeSurrounding(ticks)
                } else {
                    raw
                }
            }
        }
        return found
    }

    private fun parse(markdown: String): ASTNode {
        val parser = MarkdownParser(
            GFMFlavourDescriptor(),
            cancellationToken = CancellationToken.NonCancellable,
        )
        return parser.buildMarkdownTreeFromString(markdown as CharSequence)
    }

    private fun walk(node: ASTNode, visit: (ASTNode) -> Unit) {
        visit(node)
        if (node.type == MarkdownElementTypes.CODE_FENCE || node.type == MarkdownElementTypes.CODE_SPAN) return
        node.children.forEach { walk(it, visit) }
    }
}

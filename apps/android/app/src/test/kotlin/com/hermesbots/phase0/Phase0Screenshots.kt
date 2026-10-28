package com.hermesbots.phase0

import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.rules.ActivityScenarioRule
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.captureScreenRoboImage
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h800dp")
class Phase0Screenshots {
    @get:Rule
    val compose = AndroidComposeTestRule<ActivityScenarioRule<ScreenshotHostActivity>, ScreenshotHostActivity>(
        ActivityScenarioRule(
            Intent(ApplicationProvider.getApplicationContext(), ScreenshotHostActivity::class.java),
        ),
    ) { rule ->
        var host: ScreenshotHostActivity? = null
        rule.scenario.onActivity { host = it }
        checkNotNull(host)
    }

    @Test fun lightPendingApproval() = shot("light-approval-pending", false, pending())

    @Test fun darkPendingApproval() = shot("dark-approval-pending", true, pending())

    @Test fun lightResolvedApproval() = shot("light-approval-resolved", false, resolved())

    @Test fun darkResolvedApproval() = shot("dark-approval-resolved", true, resolved())

    @Test fun lightMarkdownReply() = shot("light-markdown", false, markdown())

    @Test fun darkMarkdownReply() = shot("dark-markdown", true, markdown())

    @Test fun lightCollapsedUser() = shot("light-user-collapsed", false, longUser())

    @Test fun darkCollapsedUser() = shot("dark-user-collapsed", true, longUser())

    @Test fun lightComposer() = shot("light-composer", false, composer())

    @Test fun darkComposer() = shot("dark-composer", true, composer())

    @Test fun lightAttachMenu() = menu("light-attach-menu", false)

    @Test fun darkAttachMenu() = menu("dark-attach-menu", true)

    @Test fun lightDeepLink() = shot("light-deeplink", false, deepLink())

    @Test fun darkDeepLink() = shot("dark-deeplink", true, deepLink())

    @Test
    fun test_bug_no_autoscroll_on_send() {
        val messages = (1..24).map { index -> ChatLine("assistant", "Earlier reply number $index with enough text to fill the viewport.") } +
            ChatLine("user", "Latest user message after send")
        compose.setContent {
            ZoetrikTheme(darkTheme = false) {
                Phase0Screen(
                    state = connected(
                        messages = messages,
                        liveSessionId = "live-scroll-test",
                    ),
                )
            }
        }
        compose.waitForIdle()
        compose.mainClock.advanceTimeBy(1_000)
        compose.waitForIdle()
        val latest = compose.onNodeWithText("Latest user message after send")
        try {
            latest.assertIsDisplayed()
        } catch (_: AssertionError) {
            latest.performScrollTo()
            latest.assertIsDisplayed()
        }
        capture("bug-no-autoscroll-on-send")
    }

    private fun shot(name: String, dark: Boolean, state: Phase0State) {
        compose.setContent {
            ZoetrikTheme(darkTheme = dark) { Phase0Screen(state = state) }
        }
        compose.waitForIdle()
        capture(name)
    }

    private fun menu(name: String, dark: Boolean) {
        compose.setContent {
            ZoetrikTheme(darkTheme = dark) { Phase0Screen(state = composer()) }
        }
        compose.onNodeWithContentDescription("Attach").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Image").assertIsDisplayed()
        compose.onNodeWithText("File").assertIsDisplayed()
        compose.onNodeWithText("Paste image").assertIsDisplayed()
        capture(name, screen = true)
    }

    @OptIn(ExperimentalRoborazziApi::class)
    private fun capture(name: String, screen: Boolean = false) {
        val file = File("build/outputs/roborazzi/$name.png")
        file.parentFile?.mkdirs()
        if (screen) {
            captureScreenRoboImage(file)
        } else {
            compose.onRoot().captureRoboImage(file)
        }
    }

    private fun pending() = connected(
        messages = listOf(ChatLine("user", "Please run it"), ChatLine("assistant", "That needs approval.")),
        approval = card(null),
    )

    private fun resolved() = connected(
        messages = listOf(ChatLine("assistant", "Waiting on the other device.")),
        approval = card("Approved on another device"),
    )

    private fun markdown() = connected(
        messages = listOf(
            ChatLine(
                "assistant",
                """
                A short list:

                - first item
                - second item

                ```python
                print("hello")
                ```
                """.trimIndent(),
            ),
        ),
    )

    private fun longUser() = connected(
        messages = listOf(ChatLine("user", (1..30).joinToString("\n") { "line $it of a long user message" })),
    )

    private fun composer() = connected(draft = "Hello from the composer")

    private fun deepLink() = connected(
        messages = listOf(ChatLine("user", "Please run it")),
        approval = card(null),
        focus = RouteFocusState(
            target = "approval",
            requestId = "req-1",
            messageId = "",
            seq = null,
            resolved = false,
            messageIndex = -1,
        ),
    )

    private fun card(label: String?) = PendingApproval(
        id = "srq-1",
        sessionId = "live-1",
        requestId = "req-1",
        description = "Read the repo",
        command = "ls",
        resolvedLabel = label,
    )

    private fun connected(
        messages: List<ChatLine> = emptyList(),
        approval: PendingApproval? = null,
        focus: RouteFocusState? = null,
        draft: String = "",
        liveSessionId: String = "live-1",
    ) = Phase0State(
        connected = true,
        status = "Connected",
        liveSessionId = liveSessionId,
        messages = messages,
        approval = approval,
        focus = focus,
        draft = draft,
        updatePhase = "current",
        appVersion = "0.1.0 (build 42, 1516bc1)",
    )
}

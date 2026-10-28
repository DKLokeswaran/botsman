package com.hermesbots.phase0

import android.app.Application
import android.app.NotificationManager
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class Phase0NotificationTest {
    private val raw =
        """{"kind":"approval","title":"Approval waiting","body":"Read the repo","session_id":"live-1","profile":"default","request_id":"req-1","message_id":"","seq":null}"""

    @Test
    fun test_bug_notification_cleared_when_answered_elsewhere() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        showHermesNotification(context, raw)
        val manager = context.getSystemService(NotificationManager::class.java)
        val posted = manager.activeNotifications
        assertEquals(1, posted.size)
        assertEquals(approvalNotificationId("req-1"), posted[0].id)
        val actions = posted[0].notification.actions
        assertEquals(2, actions.size)
        assertEquals("Allow once", actions[0].title.toString())
        assertEquals("Deny", actions[1].title.toString())
        val allow = Shadows.shadowOf(actions[0].actionIntent).savedIntent
        val deny = Shadows.shadowOf(actions[1].actionIntent).savedIntent
        assertEquals("once", allow.getStringExtra("push_action"))
        assertEquals("deny", deny.getStringExtra("push_action"))
        assertEquals(raw, allow.getStringExtra("push_json"))
        assertEquals(raw, deny.getStringExtra("push_json"))
        dismissApprovalNotification(context, "req-1")
        assertEquals(0, manager.activeNotifications.size)
        showHermesNotification(context, raw)
        dismissApprovalNotification(context, "req-other")
        assertEquals(1, manager.activeNotifications.size)
    }
}

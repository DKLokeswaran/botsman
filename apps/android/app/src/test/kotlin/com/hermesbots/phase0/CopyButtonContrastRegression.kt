package com.hermesbots.phase0

import androidx.compose.ui.graphics.Color
import kotlin.math.pow
import org.junit.Assert.assertTrue
import org.junit.Test

class CopyButtonContrastRegression {
    @Test
    fun test_bug_light_mode_copy_button_contrast() {
        val ratio = contrastRatio(ZoetrikColors.Light.primary, ZoetrikColors.Light.surfaceVariant)
        assertTrue(
            "light Copy label contrast is ${"%.2f".format(ratio)}:1",
            ratio >= 4.5,
        )
    }

    @Test
    fun dark_mode_copy_button_contrast() {
        val ratio = contrastRatio(ZoetrikColors.Dark.primary, ZoetrikColors.Dark.surfaceVariant)
        assertTrue(
            "dark Copy label contrast is ${"%.2f".format(ratio)}:1",
            ratio >= 4.5,
        )
    }

    private fun contrastRatio(foreground: Color, background: Color): Double {
        fun channel(value: Int): Double {
            val scaled = value / 255.0
            return if (scaled <= 0.04045) scaled / 12.92 else ((scaled + 0.055) / 1.055).pow(2.4)
        }
        fun luminance(color: Color): Double {
            val red = (color.red * 255).toInt()
            val green = (color.green * 255).toInt()
            val blue = (color.blue * 255).toInt()
            return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
        }
        val fg = luminance(foreground)
        val bg = luminance(background)
        val lighter = maxOf(fg, bg)
        val darker = minOf(fg, bg)
        return (lighter + 0.05) / (darker + 0.05)
    }
}

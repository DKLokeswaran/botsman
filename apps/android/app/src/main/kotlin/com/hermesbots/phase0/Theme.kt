package com.hermesbots.phase0

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Orbitron = FontFamily(
    Font(
        R.font.orbitron_variable,
        FontWeight.Black,
        variationSettings = FontVariation.Settings(FontVariation.weight(900)),
    ),
)
private val Tomorrow = FontFamily(Font(R.font.tomorrow_semibold, FontWeight.SemiBold))
private val Inter = FontFamily(
    Font(
        R.font.inter_variable,
        FontWeight.Normal,
        variationSettings = FontVariation.Settings(FontVariation.weight(400)),
    ),
)
val FragmentMono = FontFamily(Font(R.font.fragment_mono, FontWeight.Normal))

private fun lightScheme(colors: MaterialScheme) = lightColorScheme(
    primary = colors.primary,
    onPrimary = colors.onPrimary,
    background = colors.background,
    onBackground = colors.onBackground,
    surface = colors.surface,
    onSurface = colors.onSurface,
    surfaceVariant = colors.surfaceVariant,
    onSurfaceVariant = colors.onSurfaceVariant,
    outline = colors.outline,
    error = colors.error,
    tertiary = colors.tertiary,
    onTertiary = colors.onTertiary,
)

private fun darkScheme(colors: MaterialScheme) = darkColorScheme(
    primary = colors.primary,
    onPrimary = colors.onPrimary,
    background = colors.background,
    onBackground = colors.onBackground,
    surface = colors.surface,
    onSurface = colors.onSurface,
    surfaceVariant = colors.surfaceVariant,
    onSurfaceVariant = colors.onSurfaceVariant,
    outline = colors.outline,
    error = colors.error,
    tertiary = colors.tertiary,
    onTertiary = colors.onTertiary,
)

private val Type = Typography(
    headlineMedium = TextStyle(fontFamily = Orbitron, fontWeight = FontWeight.Black, fontSize = 22.sp, letterSpacing = 0.4.sp),
    titleMedium = TextStyle(fontFamily = Tomorrow, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 1.2.sp),
    bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    labelMedium = TextStyle(fontFamily = Tomorrow, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.1.sp),
)

@Composable
fun ZoetrikTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) ZoetrikColors.Dark else ZoetrikColors.Light
    MaterialTheme(
        colorScheme = if (darkTheme) darkScheme(colors) else lightScheme(colors),
        typography = Type,
        content = content,
    )
}

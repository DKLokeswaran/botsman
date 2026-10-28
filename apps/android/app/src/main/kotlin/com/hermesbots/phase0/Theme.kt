package com.hermesbots.phase0

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
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

private val Dark = darkColorScheme(
    primary = Color(0xFFFFA41C),
    onPrimary = Color(0xFF000000),
    background = Color(0xFF000000),
    onBackground = Color(0xFFFFFFFF),
    surface = Color(0xFF111111),
    onSurface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFF151515),
    onSurfaceVariant = Color(0xFF999999),
    outline = Color(0xFF262626),
    error = Color(0xFFF87171),
)

private val Light = lightColorScheme(
    primary = Color(0xFFB73208),
    onPrimary = Color(0xFFFFFFFF),
    background = Color(0xFFF2F0EB),
    onBackground = Color(0xFF111111),
    surface = Color(0xFFE8E5DE),
    onSurface = Color(0xFF111111),
    surfaceVariant = Color(0xFFDEDCD7),
    onSurfaceVariant = Color(0xFF4E4C47),
    outline = Color(0xFFD4D0C6),
    error = Color(0xFFB42318),
)

private val Type = Typography(
    headlineMedium = TextStyle(fontFamily = Orbitron, fontWeight = FontWeight.Black, fontSize = 22.sp, letterSpacing = 0.4.sp),
    titleMedium = TextStyle(fontFamily = Tomorrow, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 1.2.sp),
    bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    labelMedium = TextStyle(fontFamily = Tomorrow, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.1.sp),
)

@Composable
fun ZoetrikTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = Type,
        content = content,
    )
}

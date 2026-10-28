import org.gradle.api.tasks.testing.Test

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.hermesbots.phase0"
    compileSdk = 37

    signingConfigs {
        getByName("debug") {
            storeFile = file("hermes-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    defaultConfig {
        applicationId = "com.hermesbots.phase0"
        minSdk = 26
        targetSdk = 35
        val runRaw = System.getenv("GITHUB_RUN_NUMBER")?.trim().orEmpty()
        val shaRaw = System.getenv("GITHUB_SHA")?.trim().orEmpty()
        val buildLabel = if (runRaw.matches(Regex("\\d+"))) runRaw else "dev"
        val shaLabel = if (shaRaw.matches(Regex("[0-9a-fA-F]{7,}"))) shaRaw.take(7) else "dev"
        versionCode = buildLabel.toIntOrNull() ?: 1
        versionName = "0.1.0"
        buildConfigField("String", "HERMES_VERSION_NAME", "\"0.1.0\"")
        buildConfigField("String", "HERMES_BUILD", "\"$buildLabel\"")
        buildConfigField("String", "HERMES_SHA", "\"$shaLabel\"")
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.isReturnDefaultValues = true
    }

    sourceSets.getByName("main") {
        res.srcDir("../../../tokens/android-res")
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
            excludes += "META-INF/LICENSE*"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// security-crypto brings tink-android. The UnifiedPush connector brings the JVM tink jar.
// Both contain the same com.google.crypto.tink classes. Keep the Android artifact.
configurations.configureEach {
    exclude(group = "com.google.crypto.tink", module = "tink")
}

dependencies {
    implementation(project(":hermes-client"))
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("org.unifiedpush.android:connector:3.3.5")
    implementation("com.mikepenz:multiplatform-markdown-renderer:0.46.0")
    implementation("com.mikepenz:multiplatform-markdown-renderer-m3:0.46.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation(composeBom)
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.77.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.77.0")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("androidx.compose.ui:ui-test-manifest")
}

tasks.withType<Test>().configureEach {
    // Record the images. Do not fail the build on a missing or different golden.
    systemProperty("roborazzi.test.record", "true")
    systemProperty("roborazzi.output.dir", layout.buildDirectory.dir("outputs/roborazzi").get().asFile.absolutePath)
}

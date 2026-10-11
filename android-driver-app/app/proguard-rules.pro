-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable

# Retrofit
-keep class retrofit2.** { *; }
-keepattributes Exceptions

# OkHttp
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep interface okhttp3.** { *; }

# Gson
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Socket.IO
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# OSMDroid
-keep class org.osmdroid.** { *; }
-dontwarn org.osmdroid.**

# Keep data models
-keep class com.iiitdharwad.bustracker.data.model.** { *; }

# FusedLocation
-keep class com.google.android.gms.location.** { *; }

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignUp, useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Feather } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

const FOREST = "#2F4842";
const DEEP = "#1A2F2B";
const SAGE = "#5A7A71";
const CREAM = "#EBD9B4";
const SAND = "#D4B483";
const TERRACOTTA = "#b85a47";
const BG = "#1A2F2B";

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          router.replace(decorateUrl("/(tabs)") as any);
        },
      });
    }
  };

  const handleSSO = useCallback(
    async (strategy: "oauth_google" | "oauth_apple") => {
      if (strategy === "oauth_google") setGoogleLoading(true);
      else setAppleLoading(true);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        if (createdSessionId) {
          await setActive!({
            session: createdSessionId,
            navigate: async ({ decorateUrl }) => {
              router.replace(decorateUrl("/(tabs)") as any);
            },
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setGoogleLoading(false);
        setAppleLoading(false);
      }
    },
    [startSSOFlow, router],
  );

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, { marginTop: 80 }]}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.hint}>We sent a code to {email}</Text>
          <TextInput
            style={styles.input}
            value={code}
            placeholder="6-digit code"
            placeholderTextColor={SAGE}
            onChangeText={setCode}
            keyboardType="numeric"
            autoFocus
          />
          {errors.fields.code && <Text style={styles.error}>{errors.fields.code.message}</Text>}
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              fetchStatus === "fetching" && styles.primaryBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching"
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Verify email</Text>}
          </Pressable>
          <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.textLink}>
            <Text style={styles.textLinkText}>Resend code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Wayfare</Text>
        <Text style={styles.subtitle}>Start your journey</Text>

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.8 }]}
            onPress={() => handleSSO("oauth_google")}
            disabled={googleLoading}
          >
            <Feather name="globe" size={18} color={DEEP} style={{ marginRight: 10 }} />
            <Text style={styles.oauthBtnText}>Continue with Google</Text>
            {googleLoading && <ActivityIndicator size="small" color={DEEP} style={{ marginLeft: 8 }} />}
          </Pressable>
          {Platform.OS === "ios" && (
            <Pressable
              style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.8 }]}
              onPress={() => handleSSO("oauth_apple")}
              disabled={appleLoading}
            >
              <Feather name="smartphone" size={18} color={DEEP} style={{ marginRight: 10 }} />
              <Text style={styles.oauthBtnText}>Continue with Apple</Text>
              {appleLoading && <ActivityIndicator size="small" color={DEEP} style={{ marginLeft: 8 }} />}
            </Pressable>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={email}
            placeholder="you@example.com"
            placeholderTextColor={SAGE}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          {errors.fields.emailAddress && <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            placeholder="••••••••"
            placeholderTextColor={SAGE}
            secureTextEntry
            onChangeText={setPassword}
            autoComplete="new-password"
          />
          {errors.fields.password && <Text style={styles.error}>{errors.fields.password.message}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (!email || !password || fetchStatus === "fetching") && styles.primaryBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSubmit}
            disabled={!email || !password || fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching"
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Create account</Text>}
          </Pressable>

          {/* Required for Clerk bot protection */}
          <View nativeID="clerk-captcha" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in">
              <Text style={styles.footerLink}>Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: 20, paddingVertical: 60 },
  brand: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: 6, color: CREAM, textTransform: "uppercase", marginBottom: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: SAGE, marginBottom: 28 },
  card: { width: "100%", maxWidth: 400, backgroundColor: "rgba(47,72,66,0.35)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(90,122,113,0.3)" },
  oauthBtn: { flexDirection: "row", alignItems: "center", backgroundColor: CREAM, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10, justifyContent: "center" },
  oauthBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: DEEP },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(90,122,113,0.3)" },
  dividerText: { fontFamily: "Inter_400Regular", color: SAGE, fontSize: 13, marginHorizontal: 10 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: CREAM, marginBottom: 6 },
  input: { backgroundColor: "rgba(26,47,43,0.6)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(90,122,113,0.4)", paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 15, color: CREAM, marginBottom: 12 },
  primaryBtn: { backgroundColor: FOREST, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: CREAM },
  error: { fontFamily: "Inter_400Regular", fontSize: 12, color: TERRACOTTA, marginTop: -8, marginBottom: 8 },
  textLink: { alignItems: "center", marginTop: 12 },
  textLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, color: SAND },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { fontFamily: "Inter_400Regular", fontSize: 14, color: SAGE },
  footerLink: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: SAND },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: CREAM, marginBottom: 8, textAlign: "center" },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, color: SAGE, marginBottom: 16, textAlign: "center" },
});

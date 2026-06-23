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
import { useSignIn, useSSO } from "@clerk/expo";
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

function WayfareMark() {
  return (
    <View style={styles.mark}>
      <View style={styles.markDisc}>
        <View style={styles.markSun} />
      </View>
    </View>
  );
}

function OAuthButton({
  label,
  icon,
  onPress,
  loading,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={loading}
    >
      <Feather name={icon as any} size={18} color={DEEP} style={{ marginRight: 10 }} />
      <Text style={styles.oauthBtnText}>{label}</Text>
      {loading && <ActivityIndicator size="small" color={DEEP} style={{ marginLeft: 8 }} />}
    </Pressable>
  );
}

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const handleEmailSignIn = async () => {
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          router.replace(decorateUrl("/(tabs)") as any);
        },
      });
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code: verifyCode });
    if (signIn.status === "complete") {
      await signIn.finalize({
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

  if (signIn.status === "needs_client_trust") {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Verify your account</Text>
          <TextInput
            style={styles.input}
            value={verifyCode}
            placeholder="Verification code"
            placeholderTextColor={SAGE}
            onChangeText={setVerifyCode}
            keyboardType="numeric"
          />
          {errors.fields.code && <Text style={styles.error}>{errors.fields.code.message}</Text>}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching"
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Verify</Text>}
          </Pressable>
          <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={styles.textLink}>
            <Text style={styles.textLinkText}>Resend code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <WayfareMark />
        <Text style={styles.brand}>Wayfare</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        <View style={styles.card}>
          <OAuthButton label="Continue with Google" icon="globe" onPress={() => handleSSO("oauth_google")} loading={googleLoading} />
          {Platform.OS === "ios" && (
            <OAuthButton label="Continue with Apple" icon="smartphone" onPress={() => handleSSO("oauth_apple")} loading={appleLoading} />
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
          {errors.fields.identifier && <Text style={styles.error}>{errors.fields.identifier.message}</Text>}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            placeholder="••••••••"
            placeholderTextColor={SAGE}
            secureTextEntry
            onChangeText={setPassword}
            autoComplete="password"
          />
          {errors.fields.password && <Text style={styles.error}>{errors.fields.password.message}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (!email || !password || fetchStatus === "fetching") && styles.primaryBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleEmailSignIn}
            disabled={!email || !password || fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching"
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Sign in</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.footerLink}>Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: 20, paddingVertical: 48 },
  mark: { width: 72, height: 72, borderRadius: 36, backgroundColor: FOREST, justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 2, borderColor: CREAM },
  markDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: FOREST, justifyContent: "flex-start", alignItems: "flex-end", padding: 8 },
  markSun: { width: 10, height: 10, borderRadius: 5, backgroundColor: CREAM },
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
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: CREAM, marginBottom: 16, textAlign: "center" },
});

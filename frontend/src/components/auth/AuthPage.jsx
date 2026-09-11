import React, { useState } from "react";
import { api } from "../../services/api";

export default function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up Form State
  const [signupName, setSignupName] = useState("");
  const [signupOrgName, setSignupOrgName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Clear errors when switching tabs
  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage("");
  };

  // 1. Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.login({
        email: loginEmail.trim(),
        password: loginPassword
      });

      // Save session in localStorage
      api.auth.setSession(response.token, response.user);

      // Notify parent App component
      onAuthSuccess(response.user);
    } catch (err) {
      setErrorMessage(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Organization & User Signup
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!signupName.trim()) {
      setErrorMessage("Your full name is required.");
      return;
    }
    if (!signupOrgName.trim()) {
      setErrorMessage("Company / Organization name is required.");
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.signup({
        name: signupName.trim(),
        organizationName: signupOrgName.trim(),
        email: signupEmail.trim(),
        password: signupPassword
      });

      // Save session in localStorage
      api.auth.setSession(response.token, response.user);

      // Notify parent App component
      onAuthSuccess(response.user);
    } catch (err) {
      setErrorMessage(err.message || "Registration failed. Please check the provided information.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Outer Auth Card Container */}
      <div className="relative w-full max-w-md md:max-w-4xl min-h-[560px] md:min-h-[620px] bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm md:shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* ============================================================= */}
        {/* GIANT CURVED PURPLE SHAPE (ANIMATED SWEEP OVERLAY)             */}
        {/* Perfectly calibrated curve geometry:                          */}
        {/* - Never overlaps any form inputs (Sign In or Sign Up)         */}
        {/* - 100% envelops the promotional text and buttons on purple     */}
        {/* ============================================================= */}
        <div
          className="hidden md:block absolute w-[2800px] h-[2800px] rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 z-[10] pointer-events-none transition-transform will-change-transform shadow-2xl"
          style={{
            left: "calc(51% - 2800px)",
            top: "-1300px",
            transform: mode === "signup" ? "translateX(calc(100% - 2%))" : "translateX(0%)",
            transitionDuration: "850ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {/* Ambient Decorative Glows */}
          <div className="absolute bottom-60 left-60 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-32 right-60 w-80 h-80 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />
        </div>

        {/* ============================================================= */}
        {/* LEFT PROMOTIONAL CONTENT (Visible on Purple Curve in Sign In)  */}
        {/* Compact & centered in the left 50% to stay 100% inside purple */}
        {/* ============================================================= */}
        <div
          className={`hidden md:flex md:w-1/2 md:absolute md:left-0 md:top-0 md:bottom-0 md:h-full flex-col justify-between py-10 px-6 z-[20] text-white text-center items-center select-none transition-all ${
            mode === "signin"
              ? "opacity-100 translate-x-0 pointer-events-auto duration-500 delay-200"
              : "opacity-0 -translate-x-12 pointer-events-none duration-300"
          }`}
        >
          {/* Top Brand Monogram */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-white font-bold text-xl flex items-center justify-center border border-white/20 shadow-lg mb-2">
              CS
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-200">
              Sales & CRM Suite
            </span>
          </div>

          {/* Center Call-to-action */}
          <div className="w-full max-w-[240px] space-y-3 my-auto flex flex-col items-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              New here?
            </h2>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Join us today and discover a world of possibilities. Create your account in seconds!
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="px-7 py-2.5 rounded-full border-2 border-white/90 hover:bg-white hover:text-indigo-700 text-white text-xs font-bold tracking-wider uppercase transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Bottom Tagline */}
          <p className="text-[11px] text-indigo-200/80">
            Enterprise CRM & Sales Suite
          </p>
        </div>

        {/* ============================================================= */}
        {/* RIGHT PROMOTIONAL CONTENT (Visible on Purple Curve in Sign Up) */}
        {/* Compact & centered in right 50% to stay 100% inside purple    */}
        {/* ============================================================= */}
        <div
          className={`hidden md:flex md:w-1/2 md:absolute md:right-0 md:left-auto md:top-0 md:bottom-0 md:h-full flex-col justify-between py-10 px-6 z-[20] text-white text-center items-center select-none transition-all ${
            mode === "signup"
              ? "opacity-100 translate-x-0 pointer-events-auto duration-500 delay-200"
              : "opacity-0 translate-x-12 pointer-events-none duration-300"
          }`}
        >
          {/* Top Brand Monogram */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-white font-bold text-xl flex items-center justify-center border border-white/20 shadow-lg mb-2">
              CS
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-200">
              Sales & CRM Suite
            </span>
          </div>

          {/* Center Call-to-action */}
          <div className="w-full max-w-[240px] space-y-3 my-auto flex flex-col items-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              One of us?
            </h2>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Welcome back! Sign in to continue your journey and manage your organization workspace.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="px-7 py-2.5 rounded-full border-2 border-white/90 hover:bg-white hover:text-indigo-700 text-white text-xs font-bold tracking-wider uppercase transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Bottom Tagline */}
          <p className="text-[11px] text-indigo-200/80">
            Enterprise CRM & Sales Suite
          </p>
        </div>

        {/* ============================================================= */}
        {/* LEFT PANEL: SIGN UP / CREATE ORGANIZATION FORM                */}
        {/* Stationed on Left (0% - 50%). Completely unobstructed         */}
        {/* ============================================================= */}
        <div
          className={`w-full md:w-1/2 md:absolute md:left-0 md:top-0 md:bottom-0 md:h-full flex flex-col justify-center px-6 py-8 sm:px-10 z-[5] overflow-y-auto ${
            mode === "signup"
              ? "block md:opacity-100 md:translate-x-0 md:pointer-events-auto transition-all duration-500 delay-200"
              : "hidden md:flex md:opacity-0 md:-translate-x-12 md:pointer-events-none transition-all duration-300"
          }`}
        >
          <div className="w-full max-w-[320px] mx-auto flex flex-col">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20 mx-auto mb-3 md:hidden">
                CS
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Create Organization
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Create a new organization workspace
              </p>
            </div>

            {/* Mobile Switch Tabs (Visible only on small screens) */}
            <div className="flex md:hidden p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="flex-1 py-2 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs transition-all cursor-pointer"
              >
                Create Organization
              </button>
            </div>

            {/* Error Alert Banner */}
            {errorMessage && mode === "signup" && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* SIGN UP FORM */}
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={signupOrgName}
                  onChange={(e) => setSignupOrgName(e.target.value)}
                  placeholder="e.g. Apex Global Corp"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="alex@apexcorp.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-5 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating workspace...</span>
                  </>
                ) : (
                  <span>Create Workspace & Sign In</span>
                )}
              </button>
            </form>

            {/* Mobile switcher link */}
            <div className="mt-4 text-center md:hidden">
              <span className="text-xs text-slate-500">Already have an account? </span>
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* RIGHT PANEL: SIGN IN FORM                                     */}
        {/* Stationed on Right (50% - 100%). Completely unobstructed       */}
        {/* ============================================================= */}
        <div
          className={`w-full md:w-1/2 md:absolute md:right-0 md:left-auto md:top-0 md:bottom-0 md:h-full flex flex-col justify-center px-6 py-8 sm:px-10 z-[5] overflow-y-auto ${
            mode === "signin"
              ? "block md:opacity-100 md:translate-x-0 md:pointer-events-auto transition-all duration-500 delay-200"
              : "hidden md:flex md:opacity-0 md:translate-x-12 md:pointer-events-none transition-all duration-300"
          }`}
        >
          <div className="w-full max-w-[320px] mx-auto flex flex-col">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20 mx-auto mb-3 md:hidden">
                CS
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign In
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Sign in to access your workspace
              </p>
            </div>

            {/* Mobile Switch Tabs (Visible only on small screens) */}
            <div className="flex md:hidden p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="flex-1 py-2 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                Create Organization
              </button>
            </div>

            {/* Error Alert Banner */}
            {errorMessage && mode === "signin" && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* SIGN IN FORM */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-5 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in to Workspace</span>
                )}
              </button>
            </form>

            {/* Mobile switcher link */}
            <div className="mt-4 text-center md:hidden">
              <span className="text-xs text-slate-500">Don't have an account? </span>
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Create Organization
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

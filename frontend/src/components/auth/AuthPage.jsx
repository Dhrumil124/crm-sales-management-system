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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20 mx-auto mb-3">
            CS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sales & CRM Suite
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "signin"
              ? "Sign in to access your workspace"
              : "Create a new organization workspace"}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => handleSwitchMode("signin")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "signin"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("signup")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Create Organization
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SIGN IN FORM */}
        {/* ------------------------------------------------------------- */}
        {mode === "signin" ? (
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
        ) : (
          /* ------------------------------------------------------------- */
          /* CREATE ORGANIZATION & ADMIN USER FORM */
          /* ------------------------------------------------------------- */
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
        )}
      </div>
    </div>
  );
}

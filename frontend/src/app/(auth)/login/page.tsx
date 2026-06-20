"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/api/services";

const schema = z.object({
  email:    z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  // Fire-and-forget: wake a sleeping Render instance / suspended Neon
  // compute as soon as the login page loads, so the cold-start latency is
  // (mostly) absorbed while the user is still typing their credentials
  // instead of being eaten by the actual login request's timeout budget.
  useEffect(() => {
    authApi.warmUp().catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    clearError();
    try {
      await login(data.email, data.password);
      router.replace("/dashboard");
    } catch { /* error shown via store */ }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-[#243A6A] overflow-hidden">
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, #C8A84B 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[radial-gradient(circle,rgba(200,168,75,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-sm bg-white rounded-[20px] shadow-[0_32px_80px_rgba(13,26,51,0.4)] p-9">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(200,168,75,0.4)]">
            <span className="text-navy-deep font-bold text-2xl font-serif">SH</span>
          </div>
          <h1 className="text-navy text-lg font-semibold font-serif">
            Sacred Heart Catholic High School
          </h1>
          <p className="text-xs text-[#5A6A8A] mt-1">School Management System · Monrovia, Liberia</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-[var(--err-bg)] border border-[var(--err-border)] rounded-lg text-sm text-[var(--err)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Email Address</label>
            <input {...register("email")} type="email" className="form-input" placeholder="admin@sacredheart.edu.lr" />
            {errors.email && <p className="text-xs text-[var(--err)] mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                className="form-input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-navy transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-[var(--err)] mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-gold py-3.5 justify-center flex items-center gap-2 mt-2 disabled:opacity-60"
          >
            {isLoading ? (
              <><span className="w-4 h-4 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Signing in…</>
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#8A9ABB] mt-6">
          Sacred Heart SMS v1.0 · Academic Year 2025/2026
        </p>
      </div>
    </div>
  );
}

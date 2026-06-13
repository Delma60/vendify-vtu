import Link from "next/link";

export const metadata = {
  title: "Verify Email | VTU Platform",
};

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-3xl font-semibold text-slate-50">Verify email</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter the code sent to your inbox to verify your account.
        </p>

        <form
          action="/api/auth/verify-email"
          method="post"
          className="mt-8 space-y-6"
        >
          <label className="block">
            <span className="text-sm text-slate-300">Verification code</span>
            <input
              name="code"
              type="text"
              required
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-700 transition focus:border-slate-500 focus:ring-2"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Verify email
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Need a new code?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

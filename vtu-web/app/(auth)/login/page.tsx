import Link from "next/link";

export const metadata = {
  title: "Login | VTU Platform",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-3xl font-semibold text-slate-50">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Access your VTU dashboard with your email and password.
        </p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-6">
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-700 transition focus:border-slate-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-700 transition focus:border-slate-500 focus:ring-2"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Login
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400">
          <Link
            href="/forgot-password"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Forgot password?
          </Link>
          <p>
            New here?{" "}
            <Link
              href="/register"
              className="text-indigo-400 hover:text-indigo-300"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

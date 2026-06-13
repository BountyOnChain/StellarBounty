import Link from "next/link";
import LocalizedText from "./components/LocalizedText";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <h1 className="text-7xl font-black tracking-tight text-slate-600">404</h1>
      <p className="mt-4 text-lg text-slate-300"><LocalizedText id="notFound.title" /></p>
      <p className="mt-2 text-sm text-slate-500">
        <LocalizedText id="notFound.body" />
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
      >
        <LocalizedText id="notFound.backHome" />
      </Link>
    </main>
  );
}

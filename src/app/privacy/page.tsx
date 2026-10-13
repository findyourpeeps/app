import { SiteHeader } from "@/components/site-header";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-10 prose prose-zinc">
        <h1>Privacy notice (draft placeholder)</h1>
        <p>
          The launch privacy notice will be published before live enrollment.
          This slice keeps the notice visible at signup only.
        </p>
      </main>
    </>
  );
}

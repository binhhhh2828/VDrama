import { Logo } from "@/components/brand/Logo";

// Trang chủ thật làm ở Bước 4 (docs/plans/gd3-frontend.md).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <Logo height={64} preload />
      <p className="text-muted">Something good is coming. Stay tuned.</p>
    </main>
  );
}

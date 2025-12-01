import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-black text-white">
      <Link
        href={"/world"}
        className="font-black text-7xl hover:text-9xl hover:text-amber-200 transition-all"
      >
        World
      </Link>
    </div>
  );
}

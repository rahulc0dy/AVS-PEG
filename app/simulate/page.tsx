"use client";

import Link from "next/link";

const SimulationPage = () => {
  return (
    <div className="h-screen w-full flex flex-col gap-10 items-center justify-center bg-black text-white">
      <h1 className="uppercase font-black text-8xl text-transparent bg-clip-text bg-linear-to-r from-red-300 to-blue-300 transition-all">
        Simulation not yet Implemented
      </h1>
      <Link
        href={"/edit"}
        className="uppercase font-black text-7xl hover:text-9xl hover:text-rose-200 transition-all"
      >
        Edit
      </Link>
      <Link
        href={"/train"}
        className="uppercase font-black text-7xl hover:text-9xl hover:text-amber-200 transition-all"
      >
        Train
      </Link>
    </div>
  );
};
export default SimulationPage;

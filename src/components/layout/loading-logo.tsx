import Image from "next/image";
import { cn } from "@/lib/utils";

export function LoadingLogo({ className }: { className: string }) {
  return (
    <Image
      src="/nextcon-loading-3d.webp"
      alt=""
      width={288}
      height={275}
      loading="eager"
      unoptimized
      className={cn("h-auto shrink-0 motion-safe:animate-bounce", className)}
    />
  );
}

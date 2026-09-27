/** App mark — the same generated icon as the favicon and PWA icons (see frontend/art/icon.png). */
export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/icon-192.png" alt="" aria-hidden="true" className={`${className} rounded-[22.5%] ring-1 ring-hairline`} draggable={false} />
}

export function DottedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-[0.18]"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(180, 188, 200, 0.28) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }}
    />
  );
}

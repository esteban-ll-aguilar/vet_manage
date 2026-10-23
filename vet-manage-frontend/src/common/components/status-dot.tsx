type StatusDotProps = {
  status: 'online' | 'offline' | 'loading';
};

export function StatusDot({ status }: StatusDotProps) {
  return <span className={`status-dot status-dot--${status}`} aria-label={status} />;
}

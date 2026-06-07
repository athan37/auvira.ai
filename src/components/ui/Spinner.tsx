import { Loading, type LoadingSize } from './Loading';

/** @deprecated Use Loading — kept for backward compatibility. */
export function Spinner({
  className,
  size = 'md',
}: {
  className?: string;
  size?: LoadingSize;
}) {
  return <Loading variant="inline" size={size} className={className} />;
}

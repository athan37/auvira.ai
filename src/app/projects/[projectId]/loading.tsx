import { Spinner } from '@/components/ui/Spinner';

export default function ProjectLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Spinner />
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';

/**
 * Honest placeholder for a module that has not shipped yet: the navigation is
 * derived from enabled modules, so an unbuilt one says so rather than dumping
 * the producer back on the landing page.
 */
export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  const { workspaceId, eventId } = useParams();
  return (
    <EmptyState
      className="min-h-[60vh]"
      title={title}
      description={description}
      action={
        <Button asChild variant="outline">
          <Link to={`/w/${workspaceId}/events/${eventId}/overview`}>Back to overview</Link>
        </Button>
      }
    />
  );
}

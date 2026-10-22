import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/common/States';

export default function NotFound() {
  return (
    <div className="card-sw">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="The page you are looking for does not exist."
        action={<Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>}
      />
    </div>
  );
}

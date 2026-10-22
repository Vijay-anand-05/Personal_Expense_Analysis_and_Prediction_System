export default function Card({ title, subtitle, action, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`card-sw ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="small-label">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={`card-body-sw ${bodyClassName}`}>{children}</div>
    </section>
  );
}

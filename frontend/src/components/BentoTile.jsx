export function BentoTile({ children, className = '', as: Component = 'section', ...props }) {
  return (
    <Component
      className={`bento-surface rounded-3xl p-5 sm:p-6 transition-colors duration-300 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

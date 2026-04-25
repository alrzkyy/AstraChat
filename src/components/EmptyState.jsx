export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-dark-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-dark-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-dark-500 max-w-sm mb-4">{description}</p>}
      {action && action}
    </div>
  )
}

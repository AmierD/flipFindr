export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-sm">
          Your email is not authorized to use this app.
        </p>
      </div>
    </div>
  )
}

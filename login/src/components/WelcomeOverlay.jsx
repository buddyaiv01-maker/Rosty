export default function WelcomeOverlay({ name }) {
  return (
    <div className="welcome-overlay">
      <div className="welcome-glass">
        <div className="welcome-check">&#10003;</div>
        <h2>Welcome, {name}!</h2>
        <p>Redirecting…</p>
      </div>
    </div>
  );
}

import AgentAvatarConcepts from '../components/office/AgentAvatarConcepts';
import '../styles/office.css';

export default function AvatarPreview() {
  return (
    <main className="office-root" style={{ minHeight: '100vh', padding: '20px 0' }}>
      <AgentAvatarConcepts />
    </main>
  );
}

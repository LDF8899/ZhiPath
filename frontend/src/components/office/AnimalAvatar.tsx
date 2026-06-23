import { type AnimalType, ANIMAL_COLORS } from './types';
import AnimalSVG from './AnimalSVG';

interface AnimalAvatarProps {
  type: AnimalType;
  color?: string;
  size?: number;
  status?: 'idle' | 'working' | 'completed';
  className?: string;
}

export default function AnimalAvatar({ 
  type, 
  color = ANIMAL_COLORS[type] || '#f5a623',
  size = 40,
  status = 'idle',
  className = '' 
}: AnimalAvatarProps) {
  return (
    <div 
      className={`animal-avatar animal-${status} ${className}`}
      style={{ width: size, height: size }}
    >
      <AnimalSVG type={type} color={color} size={size} />
      {status === 'working' && (
        <div className="working-indicator">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      )}
      {status === 'completed' && (
        <div className="completed-check">✓</div>
      )}
    </div>
  );
}

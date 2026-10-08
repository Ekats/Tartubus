import busIcon from '../assets/bus.png';

/**
 * The app's bus artwork, used wherever a bus emoji used to be.
 * Sized to the surrounding text by default (1em tall); pass a className
 * such as "h-6" to size it explicitly.
 */
export default function BusIcon({ className = '', alt = '' }) {
  return (
    <img
      src={busIcon}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={`inline-block w-auto align-[-0.15em] select-none ${className || 'h-[1em]'}`}
    />
  );
}

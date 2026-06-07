import { cn } from '@/lib/cn';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Primary action control — Apple pill variants. */
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}

export { buttonClassName, buttonVariants, buttonSizes } from './buttonStyles';
export type { ButtonVariant, ButtonSize } from './buttonStyles';

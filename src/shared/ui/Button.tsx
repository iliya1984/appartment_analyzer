import type { ComponentPropsWithRef } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './controls.module.css';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'default' | 'primary';
}

export function Button({ variant = 'default', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.btn, variant === 'primary' && styles.primary, className)}
      {...rest}
    />
  );
}

export function IconButton({
  className,
  type = 'button',
  ...rest
}: ComponentPropsWithRef<'button'>) {
  return <button type={type} className={cx(styles.iconBtn, className)} {...rest} />;
}

/** Class names for elements that should look like controls (inputs, selects, textareas). */
export const controlClasses = { input: styles.input, btn: styles.btn, primary: styles.primary };

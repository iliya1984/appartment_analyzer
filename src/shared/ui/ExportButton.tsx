import { type ReactNode, useState } from 'react';
import { downloadBlob } from '@/shared/lib/download';
import { Button } from './Button';

export interface ExportFile {
  name: string;
  blob: Blob;
}

export interface ExportButtonProps {
  children: ReactNode;
  /** Builds the file; null means there is nothing to export. */
  build: () => Promise<ExportFile | null>;
  onEmpty: () => void;
  onDone: (file: ExportFile) => void;
  onError: () => void;
  disabled?: boolean;
  'aria-label'?: string;
  variant?: 'default' | 'primary';
  className?: string;
  /** For tests. */
  download?: (blob: Blob, name: string) => void;
}

/** Builds a file on click and saves it; disabled while the build runs. */
export function ExportButton({
  children,
  build,
  onEmpty,
  onDone,
  onError,
  disabled = false,
  variant = 'primary',
  className,
  download = downloadBlob,
  ...rest
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const file = await build();
      if (!file) {
        onEmpty();
        return;
      }
      download(file.blob, file.name);
      onDone(file);
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => void onClick()}
      disabled={disabled || busy}
      aria-label={rest['aria-label']}
    >
      {children}
    </Button>
  );
}

import { useState } from 'react';

export interface PreviewImageProps {
  /** API URL of the image (asset file or template preview); never a value typed by the operator. */
  src: string;
  alt: string;
  className?: string | undefined;
  /** Fixed text shown when the image cannot be loaded. */
  failedText: string;
  width?: number;
  height?: number;
}

/**
 * Image preview served by the API (the server sends it with `nosniff`, a sandbox CSP and CORP same-origin). The
 * content is only ever shown as an image. A failed load is replaced by a fixed message; a new `src` needs a new
 * component instance (`key`), so the failure state never carries over.
 */
export function PreviewImage({ src, alt, className, failedText, width, height }: PreviewImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p
        className="m-0 rounded-lg border border-dashed border-warning bg-warning-surface p-3 text-center text-caption text-warning"
        role="note"
      >
        {failedText}
      </p>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}

import Image, { ImageProps } from 'next/image';
import React from 'react';

export const OptimizedImageWrapper = (props: ImageProps) => {
  return <Image {...props} placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />;
};

import React, { useEffect, useRef } from 'react';
import WrcRunClubEmbed from '../dist/wrc-runclub-embed.umd.js';

export default function WrcRunClubLogo(props) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const instance = WrcRunClubEmbed.create(mountRef.current, props);
    return () => instance.destroy();
  }, [props]);

  return <div ref={mountRef} style={{ width: props.width || 420, height: props.height || 340 }} />;
}

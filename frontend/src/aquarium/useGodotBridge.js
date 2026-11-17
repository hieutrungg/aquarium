import { useCallback, useEffect, useRef, useState } from 'react';

export function useGodotBridge(iframeRef, dto) {
  const latestDTO = useRef(dto);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const sendScene = useCallback(() => {
    if (readyRef.current && latestDTO.current) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'scene:load', payload: latestDTO.current }, window.location.origin,
      );
    }
  }, [iframeRef]);

  useEffect(() => {
    latestDTO.current = dto;
    sendScene();
  }, [dto, sendScene]);

  useEffect(() => {
    const onMessage = (event) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.origin !== window.location.origin || event.source !== frameWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
      if (message.type === 'ready') {
        readyRef.current = true;
        setReady(true);
        sendScene();
      } else {
        console.info('[AquaVerse Godot]', message.type, message.payload);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef, sendScene]);

  // Reset the handshake before mounting a fresh iframe after a build check.
  const reset = useCallback(() => {
    readyRef.current = false;
    setReady(false);
  }, []);

  return { ready, reset };
}

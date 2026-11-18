import { useCallback, useEffect, useRef, useState } from 'react';

export function useGodotBridge(iframeRef, dto, handlers = {}) {
  const latestDTO = useRef(dto);
  const latestHandlers = useRef(handlers);
  const savedScene = useRef(null);
  latestHandlers.current = handlers;
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const send = useCallback((type, payload) => {
    if (!readyRef.current) return false;
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return false;
    frameWindow.postMessage({ type, payload }, window.location.origin);
    return true;
  }, [iframeRef]);

  const sendScene = useCallback(() => {
    if (readyRef.current && latestDTO.current) {
      send('scene:load', latestDTO.current);
    }
  }, [send]);

  // React Query may structurally share the saved DTO. Compare its value rather
  // than its identity, and retain it for a fresh iframe's next ready handshake.
  const acknowledgeSave = useCallback((savedDTO) => {
    latestDTO.current = savedDTO;
    savedScene.current = JSON.stringify(savedDTO);
  }, []);

  useEffect(() => {
    latestDTO.current = dto;
    if (savedScene.current === JSON.stringify(dto)) return;
    savedScene.current = null;
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
      } else if (message.type === 'action:feed') latestHandlers.current.onFeed?.(message.payload);
      else if (message.type === 'scene:save') latestHandlers.current.onSave?.(message.payload);
      else if (message.type === 'open:species') latestHandlers.current.onOpenSpecies?.(message.payload);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef, sendScene]);

  // Reset the handshake before mounting a fresh iframe after a build check.
  const reset = useCallback(() => {
    readyRef.current = false;
    setReady(false);
  }, []);

  return { ready, reset, send, acknowledgeSave };
}

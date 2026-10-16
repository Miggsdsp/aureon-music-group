  const clearQueue = () => resetPlayer(true);

  const value = useMemo(() => ({ currentSong, queue, isPlaying, playSong, resumeSong, playQueue, next, previous, toggle, seekBy, seekTo, enqueue, enqueueMany, removeFromQueue, clearQueue }), [currentSong, isPlaying, playQueue, playSong, queue, resumeSong, next, previous, toggle, seekBy, seekTo]);

  return <PlayerContext.Provider value={value}>
    {children}
    {currentSong && <div className="aureon-player-spacer" aria-hidden="true" />}
    <audio
      ref={audioRef}
      data-aureon-member-audio="true"
      preload="auto"
      playsInline
      onPlay={event => {
        setIsPlaying(true);
        // Use the player's authoritative queue refs at the audio event itself.
        // The lock-screen snapshot must not depend on a later React context
        // render in BackgroundPlaybackBridge (which can still hold the prior
        // track while Safari is promoting this audio session).
        const song = queueRef.current[indexRef.current];
        if (song) updateNativeMetadata(song, event.currentTarget, 'playing');
      }}
      onPlaying={event => {
        const song = queueRef.current[indexRef.current];
        if (song) updateNativeMetadata(song, event.currentTarget, 'playing');
      }}
      onPause={event => {
        setIsPlaying(false);
        const song = queueRef.current[indexRef.current];
        if (song && event.currentTarget.currentTime > 0) void memberActivity('progress', song, event.currentTarget.currentTime, event.currentTarget.duration || 0);
      }}
      onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
      onLoadedMetadata={event => {
        setDuration(event.currentTarget.duration);
        const song = queueRef.current[indexRef.current];
        if (song) updateNativeMetadata(song, event.currentTarget, event.currentTarget.paused ? 'paused' : 'playing');
      }}

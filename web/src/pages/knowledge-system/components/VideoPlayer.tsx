import { useState, useRef, useEffect } from 'react';

interface VideoPlayerProps {
  title: string;
  duration: string;
  resourceId: string; // 新增：课件ID，用于保存进度
  src?: string;
  mediaType?: 'video' | 'audio';
  initialTime?: number;
  initialCompleted?: boolean;
  onProgress?: (percent: number, lastPosition?: { currentTime: number; duration: number }) => void;
  onSaveProgress?: (percent: number, lastPosition: { currentTime: number; duration: number }, completed: boolean) => void;
  onComplete?: () => void;
}

export default function VideoPlayer({
  title,
  duration,
  resourceId,
  src,
  mediaType = 'video',
  initialTime = 0,
  initialCompleted = false,
  onProgress,
  onSaveProgress,
  onComplete,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [totalTime] = useState(900); // 15分钟 = 900秒
  const [speed, setSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [completed, setCompleted] = useState(initialCompleted);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const maxWatchedRef = useRef(initialTime);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  useEffect(() => {
    setCurrentTime(initialTime);
    setCompleted(initialCompleted);
    maxWatchedRef.current = initialTime;
  }, [resourceId, initialTime, initialCompleted]);

  useEffect(() => {
    if (src) return undefined;
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + speed;
          const percent = Math.min((next / totalTime) * 100, 100);
          onProgress?.(Math.round(percent), { currentTime: next, duration: totalTime });
          
          // 视频播放完成
          if (next >= totalTime) {
            setIsPlaying(false);
            setCompleted(true);
            onSaveProgress?.(100, { currentTime: totalTime, duration: totalTime }, true);
            onComplete?.();
            if (intervalRef.current) clearInterval(intervalRef.current);
            return totalTime;
          }
          
          if (Math.floor(next) % 10 === 0) {
            onSaveProgress?.(Math.round(percent), { currentTime: next, duration: totalTime }, false);
          }
          
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, totalTime, resourceId, onProgress, onSaveProgress, onComplete, src]);

  useEffect(() => {
    if (!src) return undefined;
    const saveInterval = setInterval(() => {
      const media = mediaRef.current;
      if (!media || !Number.isFinite(media.duration) || media.duration <= 0 || media.currentTime <= 0) return;
      const percent = Math.round((media.currentTime / media.duration) * 100);
      onSaveProgress?.(percent, { currentTime: media.currentTime, duration: media.duration }, false);
    }, 10000);
    return () => clearInterval(saveInterval);
  }, [src, resourceId, onSaveProgress]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = (currentTime / totalTime) * 100;

  if (src) {
    const progressPercent = currentTime > 0 && mediaRef.current?.duration
      ? Math.min(100, (currentTime / mediaRef.current.duration) * 100)
      : 0;
    const MediaTag = mediaType === 'audio' ? 'audio' : 'video';
    return (
      <div className="bg-gray-950 rounded-2xl overflow-hidden">
        <div className={`relative ${mediaType === 'video' ? 'aspect-video' : 'h-56'} bg-black flex items-center justify-center`}>
          <MediaTag
          ref={mediaRef as never}
          src={src}
          className={mediaType === 'video' ? 'w-full h-full bg-black' : 'hidden'}
          onLoadedMetadata={(e) => {
            const media = e.currentTarget;
            const resumeAt = Math.min(initialTime, Math.max(0, media.duration - 1));
            if (resumeAt > 0) media.currentTime = resumeAt;
            setCurrentTime(resumeAt);
            maxWatchedRef.current = resumeAt;
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onSeeking={(e) => {
            const media = e.currentTarget;
            if (media.currentTime > maxWatchedRef.current + 1) {
              media.currentTime = maxWatchedRef.current;
            }
          }}
          onTimeUpdate={(e) => {
            const media = e.currentTarget;
            if (media.duration > 0) {
              maxWatchedRef.current = Math.max(maxWatchedRef.current, media.currentTime);
              setCurrentTime(media.currentTime);
              onProgress?.(Math.round((media.currentTime / media.duration) * 100), {
                currentTime: media.currentTime,
                duration: media.duration,
              });
            }
          }}
          onEnded={() => {
            const media = mediaRef.current;
            const durationSeconds = media?.duration || totalTime;
            onSaveProgress?.(100, { currentTime: durationSeconds, duration: durationSeconds }, true);
            setCompleted(true);
            onComplete?.();
          }}
        />
          {mediaType === 'audio' && (
            <div className="text-center text-white">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <i className="ri-volume-up-line text-4xl"></i>
              </div>
              <div className="text-sm font-semibold">{title}</div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 bg-gray-900 text-white">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                const media = mediaRef.current;
                if (!media) return;
                if (media.paused) void media.play();
                else media.pause();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-xl`}></i>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{title}</p>
              <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
            <div className="text-xs text-gray-300 whitespace-nowrap">
              {formatTime(currentTime)} / {mediaRef.current?.duration ? formatTime(mediaRef.current.duration) : duration}
            </div>
          </div>
          {completed && <p className="text-xs text-green-300 mt-2">已完成学习</p>}
        </div>
      </div>
    );
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * totalTime;
    setCurrentTime(newTime);
    onSaveProgress?.(Math.round(percent * 100), { currentTime: newTime, duration: totalTime }, completed);
    onProgress?.(Math.round(percent * 100));
  };

  return (
    <div
      className={`relative bg-gray-950 rounded-2xl overflow-hidden group ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'aspect-video'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* 视频背景 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={`https://readdy.ai/api/search-image?query=university%20classroom%20lecture%20presentation%20screen%20with%20students%20learning%20entrepreneurship%20innovation%20course%20professional%20educational%20setting%20warm%20lighting&width=1280&height=720&seq=vp001&orientation=landscape`}
          alt="视频封面"
          className="w-full h-full object-cover object-top opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30"></div>
      </div>

      {/* 完成标识 */}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <i className="ri-checkbox-circle-fill text-4xl text-white"></i>
            </div>
            <p className="text-white text-xl font-bold mb-2">视频学习完成！</p>
            <p className="text-gray-300 text-sm">已获得学习记录</p>
            <button
              onClick={() => { 
                setCurrentTime(0); 
                setCompleted(false); 
                onSaveProgress?.(0, { currentTime: 0, duration: totalTime }, false);
              }}
              className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm transition-all whitespace-nowrap"
            >
              重新观看
            </button>
          </div>
        </div>
      )}

      {/* 中央播放按钮 */}
      {!isPlaying && !completed && (
        <button
          onClick={() => setIsPlaying(true)}
          className="absolute inset-0 flex items-center justify-center z-10 group/play"
        >
          <div className="w-20 h-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all group-hover/play:scale-110 shadow-2xl">
            <i className="ri-play-fill text-4xl text-white ml-1"></i>
          </div>
        </button>
      )}

      {/* 视频标题 */}
      <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-gray-300 text-xs mt-1">时长：{duration}</p>
      </div>

      {/* 底部控制栏 */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* 进度条 */}
        <div
          className="w-full h-1.5 bg-white/30 rounded-full mb-3 cursor-pointer group/progress hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* 播放/暂停 */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-teal-400 transition-colors"
            >
              <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-xl`}></i>
            </button>

            {/* 时间 */}
            <span className="text-white text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(totalTime)}
            </span>

            {/* 音量 */}
            <div className="relative">
              <button
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-teal-400 transition-colors"
              >
                <i className={`${volume > 50 ? 'ri-volume-up-line' : volume > 0 ? 'ri-volume-down-line' : 'ri-volume-mute-line'} text-lg`}></i>
              </button>
              {showVolumeSlider && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 rounded-xl p-3 shadow-xl">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-24 accent-teal-400"
                    style={{ writingMode: 'horizontal-tb' }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 倍速 */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-md transition-all whitespace-nowrap"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 bg-gray-900 rounded-xl overflow-hidden shadow-xl z-20">
                  {speeds.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                      className={`block w-full px-4 py-2 text-xs text-left transition-colors whitespace-nowrap ${
                        speed === s ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 全屏 */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-teal-400 transition-colors"
            >
              <i className={`${isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-lg`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* 学习进度标识 */}
      {currentTime > 0 && !completed && (
        <div className="absolute top-4 right-4 bg-teal-500/80 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
          已学习 {Math.round(progressPercent)}%
        </div>
      )}
      
      {/* 继续播放提示 */}
      {!isPlaying && currentTime > 0 && currentTime < totalTime && !completed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-xl text-sm z-10">
          <i className="ri-time-line mr-2"></i>
          上次学习到 {formatTime(currentTime)}
        </div>
      )}
    </div>
  );
}
import { useState, useRef, useEffect } from 'react';

interface VideoPlayerProps {
  title: string;
  duration: string;
  resourceId: string; // 新增：课件ID，用于保存进度
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

// 从 localStorage 读取视频进度
const getVideoProgress = (resourceId: string): { currentTime: number; completed: boolean } => {
  const key = `video_progress_${resourceId}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { currentTime: 0, completed: false };
    }
  }
  return { currentTime: 0, completed: false };
};

// 保存视频进度到 localStorage
const saveVideoProgress = (resourceId: string, currentTime: number, completed: boolean) => {
  const key = `video_progress_${resourceId}`;
  localStorage.setItem(key, JSON.stringify({ currentTime, completed }));
};

export default function VideoPlayer({ title, duration, resourceId, onProgress, onComplete }: VideoPlayerProps) {
  const savedProgress = getVideoProgress(resourceId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(savedProgress.currentTime);
  const [totalTime] = useState(900); // 15分钟 = 900秒
  const [speed, setSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [completed, setCompleted] = useState(savedProgress.completed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  // 自动保存进度
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (currentTime > 0) {
        saveVideoProgress(resourceId, currentTime, completed);
      }
    }, 5000); // 每5秒保存一次

    return () => clearInterval(saveInterval);
  }, [resourceId, currentTime, completed]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + speed;
          const percent = Math.min((next / totalTime) * 100, 100);
          onProgress?.(Math.round(percent));
          
          // 视频播放完成
          if (next >= totalTime) {
            setIsPlaying(false);
            setCompleted(true);
            saveVideoProgress(resourceId, totalTime, true);
            onComplete?.();
            if (intervalRef.current) clearInterval(intervalRef.current);
            return totalTime;
          }
          
          // 实时保存进度
          if (Math.floor(next) % 10 === 0) {
            saveVideoProgress(resourceId, next, false);
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
  }, [isPlaying, speed, totalTime, resourceId, onProgress, onComplete]);

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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * totalTime;
    setCurrentTime(newTime);
    saveVideoProgress(resourceId, newTime, completed);
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
                saveVideoProgress(resourceId, 0, false);
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
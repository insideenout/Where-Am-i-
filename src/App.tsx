import React, { useState, useEffect, useRef } from 'react';
import { Bluetooth, Camera, Radar as RadarIcon, AlertCircle, X, Crosshair, Info, Activity, Cloud, Settings, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';

// Helper to convert RSSI to a 0-100 percentage
// Typical BLE RSSI ranges from -100 (weak) to -40 (strong)
const calculateSignalPercentage = (rssi: number | null) => {
  if (rssi === null) return 0;
  
  // Use a more realistic range for BLE trackers
  const min = -110; // Expanded from -100 to -110 to increase tracking distance
  const max = -55; // Lowered from -45 to -55 so it hits 100% easier when close
  
  if (rssi >= max) return 100;
  if (rssi <= min) return 0;
  
  // Linear mapping often feels more responsive for simple radar than exponential
  const linearPercentage = ((rssi - min) / (max - min)) * 100;
  
  return Math.max(0, Math.min(100, Math.round(linearPercentage)));
};

const calculateDistanceFeet = (rssi: number | null) => {
  if (rssi === null || rssi === 0) return null;
  // Standard BLE distance formula
  const measuredPower = -69; // RSSI at 1 meter
  const n = 2; // Path loss exponent
  const distanceMeters = Math.pow(10, (measuredPower - rssi) / (10 * n));
  const distanceFeet = distanceMeters * 3.28084;
  return distanceFeet < 1 ? '< 1' : Math.round(distanceFeet);
};

type FilterType = 'samsung' | 'apple' | 'tile' | 'all';

type RadarSettings = {
  blipColor: string;
  sweepSpeed: number;
  circleCount: number;
};

const isBluetoothSupported = 'bluetooth' in navigator || (window as any).ble || (window as any).Capacitor?.Plugins?.BluetoothLe;
const isNfcSupported = 'NDEFReader' in window || (window as any).nfc;
const isCordova = !!(window as any).cordova;
const isCapacitor = !!(window as any).Capacitor;

const WelcomeScreen = ({ onStart, onNfcStart, onSmartThingsStart, isScanning, error, nfcStatus, savedDevices, manualSavedDevices, onConnectSaved, onConnectManual, customNames }: { onStart: (type: FilterType, nfcData?: string) => void, onNfcStart: () => void, onSmartThingsStart: () => void, isScanning: boolean, error: string, nfcStatus: string, savedDevices: any[], manualSavedDevices: any[], onConnectSaved: (device: any) => void, onConnectManual: (deviceData: any) => void, customNames: Record<string, string> }) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
  <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center p-6 space-y-6 overflow-y-auto">
    <div className="w-24 h-24 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(59,130,246,0.3)] shrink-0">
      <Bluetooth size={48} />
    </div>
    <div className="flex flex-col items-center">
      <h1 className="text-3xl font-bold text-white tracking-tight">Where am i?</h1>
      {isCordova && <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mt-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Cordova Mode</span>}
      {isCapacitor && <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mt-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Capacitor Mode</span>}
    </div>
    <p className="text-slate-400 text-lg">
      Locate lost trackers and BLE devices using proximity radar and AR.
    </p>

    {!isBluetoothSupported && (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left flex items-start space-x-3 w-full shrink-0">
        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-red-200">
          <strong className="block mb-1">Unsupported Browser</strong>
          <p>Your current browser (or APK wrapper) does not support Web Bluetooth. Please use <strong>Chrome on Android</strong> or <strong>Edge on Desktop</strong>.</p>
          <p className="mt-2 text-xs opacity-70">Note: Standard Android WebViews used in many APK builders do not support Bluetooth.</p>
        </div>
      </div>
    )}
    
    <button 
      onClick={() => setShowHelp(true)}
      className="bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/30 rounded-xl p-4 text-left flex items-start space-x-3 w-full group shrink-0"
    >
      <Info className="text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" size={20} />
      <div>
        <strong className="text-blue-400 block mb-1">Not finding your device?</strong>
        <p className="text-sm text-blue-200/80">Click here for crucial troubleshooting steps (like unpairing from your phone first).</p>
      </div>
    </button>

    {error && (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left flex items-start space-x-3 w-full shrink-0">
        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-red-200">{error}</p>
      </div>
    )}

    {!window.isSecureContext && (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-left flex items-start space-x-3 w-full shrink-0">
        <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-orange-200">
          <strong className="block mb-1">Insecure Connection Detected</strong>
          <p>Bluetooth and Camera APIs require a secure connection (HTTPS). If you are accessing this via a local IP address (e.g., 192.168.x.x), these features will not work. Please use localhost or a deployed HTTPS URL.</p>
        </div>
      </div>
    )}

    {nfcStatus && (
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-left flex items-start space-x-3 w-full shrink-0">
        <Activity className="text-indigo-400 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-indigo-200">{nfcStatus}</p>
      </div>
    )}

    {(savedDevices.length > 0 || manualSavedDevices.length > 0) && (
      <div className="w-full text-left bg-slate-900/50 border border-slate-800 rounded-xl p-4 shrink-0">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Saved Devices</h3>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
          {manualSavedDevices.map((dev, i) => (
            <button
              key={`manual-${i}`}
              onClick={() => onConnectManual(dev)}
              disabled={isScanning}
              className="w-full flex items-center justify-between p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="flex flex-col items-start overflow-hidden">
                <span className="font-bold text-blue-400 truncate w-full">{dev.customName}</span>
                <span className="text-[10px] text-slate-500 truncate w-full">{dev.name}</span>
              </div>
              <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded whitespace-nowrap">Find</span>
            </button>
          ))}
          {savedDevices.map((dev, i) => {
            // Don't show if already in manual list
            if (manualSavedDevices.some(m => m.id === dev.id)) return null;
            return (
              <button
                key={`browser-${i}`}
                onClick={() => onConnectSaved(dev)}
                disabled={isScanning}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-slate-200 truncate pr-2">{customNames[dev.id] || dev.name || 'Unknown Device'}</span>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded whitespace-nowrap">Connect</span>
              </button>
            );
          })}
        </div>
      </div>
    )}

    <div className="w-full grid grid-cols-2 gap-3 shrink-0 pb-8">
      <button
        onClick={() => onStart('samsung')}
        disabled={isScanning}
        className="col-span-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl font-semibold text-lg transition-all active:scale-95 flex items-center justify-center space-x-3 shadow-lg shadow-blue-900/20"
      >
        {isScanning ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <RadarIcon />
          </motion.div>
        ) : (
          <RadarIcon />
        )}
        <span>{isScanning ? 'Scanning...' : 'Find Samsung SmartTag'}</span>
      </button>
      
      <button
        onClick={() => onStart('apple')}
        disabled={isScanning}
        className="py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center space-x-2"
      >
        <span>Apple AirTag</span>
      </button>

      <button
        onClick={() => onStart('tile')}
        disabled={isScanning}
        className="py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center space-x-2"
      >
        <span>Tile Tracker</span>
      </button>

      <button
        onClick={() => onStart('all')}
        disabled={isScanning}
        className="col-span-2 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center space-x-2"
      >
        <Bluetooth size={18} />
        <span>Scan All BLE Devices</span>
      </button>

      <button
        onClick={onNfcStart}
        disabled={isScanning}
        className="py-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 disabled:opacity-50 text-indigo-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center space-x-2 mt-2"
      >
        <Activity size={18} />
        <span>Scan NFC</span>
      </button>

      <button
        onClick={onSmartThingsStart}
        disabled={isScanning}
        className="py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 disabled:opacity-50 text-cyan-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center space-x-2 mt-2"
      >
        <Cloud size={18} />
        <span>SmartThings</span>
      </button>
    </div>

    {/* Help Modal */}
    {showHelp && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-left max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Troubleshooting</h3>
            <button onClick={() => setShowHelp(false)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <strong className="text-blue-400 block mb-1">1. Unpair from your phone (CRITICAL)</strong>
              If the tracker is currently connected to your phone, it stops broadcasting to other devices. You MUST turn off Bluetooth on your phone temporarily if you are scanning from a laptop or tablet.
            </div>
            <div>
              <strong className="text-blue-400 block mb-1">2. Wake the device up</strong>
              Trackers go to sleep to save battery. Press the physical button on the tracker once to wake it up right before scanning.
            </div>
            <div>
              <strong className="text-blue-400 block mb-1">3. Try "Scan All Devices"</strong>
              In anti-stalking mode, trackers hide their name and rotate their ID. Use the "Scan All BLE Devices" button and look for an "Unknown Device".
            </div>
            <div>
              <strong className="text-blue-400 block mb-1">4. Browser Support & Flags</strong>
              Web Bluetooth only works on Chrome, Edge, and Opera. It does NOT work on iOS Safari. If the radar doesn't update, you may need to enable <code>chrome://flags/#enable-experimental-web-platform-features</code> in your browser.
            </div>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <strong className="text-red-400 block mb-1">5. APK / WebView Issue</strong>
              Standard Android APK wrappers (WebViews) do <strong>NOT</strong> support Bluetooth. 
              <p className="mt-1">To use this as an app: Open the URL in <strong>Chrome for Android</strong>, tap the 3 dots (⋮), and select <strong>"Add to Home Screen"</strong>. This installs it as a PWA with full Bluetooth support.</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowHelp(false)}
            className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
          >
            Got it
          </button>
        </motion.div>
      </div>
    )}
  </div>
  );
};

const RadarView = ({ percentage, rssi, trendValue, settings }: { percentage: number, rssi: number | null, trendValue: number, settings: RadarSettings }) => {
  // percentage 0 = edge (100% distance from center)
  // percentage 100 = center (0% distance from center)
  const distance = 100 - percentage;
  const feet = calculateDistanceFeet(rssi);
  const isFirstSignal = useRef(true);

  useEffect(() => {
    if (percentage > 0) {
      // After the first valid signal is received, we can enable transitions
      const timer = setTimeout(() => {
        isFirstSignal.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [percentage]);

  const colorMap: Record<string, { bg: string, shadow: string, border: string, text: string, arrow: string }> = {
    green: { bg: 'bg-green-500', shadow: 'shadow-[0_0_20px_#22c55e]', border: 'border-green-500', text: 'text-green-500', arrow: 'border-b-green-500' },
    blue: { bg: 'bg-blue-500', shadow: 'shadow-[0_0_20px_#3b82f6]', border: 'border-blue-500', text: 'text-blue-500', arrow: 'border-b-blue-500' },
    purple: { bg: 'bg-purple-500', shadow: 'shadow-[0_0_20px_#a855f7]', border: 'border-purple-500', text: 'text-purple-500', arrow: 'border-b-purple-500' },
    yellow: { bg: 'bg-yellow-500', shadow: 'shadow-[0_0_20px_#eab308]', border: 'border-yellow-500', text: 'text-yellow-500', arrow: 'border-b-yellow-500' },
  };

  const theme = colorMap[settings.blipColor] || colorMap.green;

  // Color shifts from red (far) to yellow (medium) to green (close)
  const getBlipColor = () => {
    if (percentage < 30) return 'bg-red-500 shadow-[0_0_20px_#ef4444]';
    if (percentage < 70) return 'bg-yellow-500 shadow-[0_0_20px_#eab308]';
    return `${theme.bg} ${theme.shadow}`;
  };

  const getBlipBorderColor = () => {
    if (percentage < 30) return 'border-red-500';
    if (percentage < 70) return 'border-yellow-500';
    return theme.border;
  };

  const circles = Array.from({ length: settings.circleCount });

  // Calculate rotation and visibility based on trendValue.
  // If trendValue > 0.5 (hotter), point forward (0 deg).
  // If trendValue < -0.5 (colder), point backward (180 deg).
  // If neutral, fade out the arrow.
  const isHotter = trendValue > 0.5;
  const isColder = trendValue < -0.5;
  const showArrow = isHotter || isColder;
  const arrowRotation = isHotter ? 0 : 180;

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-950 rounded-full overflow-hidden border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center">
      {/* Concentric Circles with subtle glow */}
      {circles.map((_, i) => {
        const margin = (i + 1) * (128 / settings.circleCount); // Distribute circles evenly
        return (
          <div 
            key={i} 
            className="absolute inset-0 border border-slate-700/50 rounded-full shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
            style={{ margin: `${margin}px` }}
          ></div>
        );
      })}

      {/* Crosshairs */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-700/50"></div>
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-slate-700/50"></div>

      {/* Sweeping Radar Gradient */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: settings.sweepSpeed, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 280deg, rgba(59, 130, 246, 0.1) 320deg, rgba(59, 130, 246, 0.4) 360deg)',
        }}
      >
        {/* Leading Edge Line */}
        <div className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-gradient-to-t from-blue-500/10 to-blue-400 shadow-[0_0_15px_#3b82f6] origin-bottom" style={{ transform: 'translateX(-50%)' }}></div>
      </motion.div>

      {/* The Target Blip */}
      {percentage > 0 && (
        <motion.div
          animate={{
            // Always position based on distance from center (top half of radar)
            top: `calc(50% - ${distance / 2}%)`,
          }}
          transition={isFirstSignal.current ? { duration: 0 } : {
            top: { type: "spring", damping: 20, stiffness: 100 },
          }}
          className="absolute z-10"
          style={{
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Directional Arrow */}
          <motion.div
            animate={{ 
              rotate: arrowRotation,
              opacity: showArrow ? 1 : 0,
              scale: showArrow ? 1 : 0.5
            }}
            transition={{ type: "spring", damping: 15 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-start justify-center"
          >
            <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${isColder ? 'border-b-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : theme.arrow + ' drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]'} -mt-4`}></div>
          </motion.div>

          {/* Ripple Effect */}
          <motion.div
            animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className={`absolute inset-0 rounded-full border-2 ${getBlipBorderColor()}`}
          />
          {/* Core Blip */}
          <div className={`w-5 h-5 rounded-full ${getBlipColor()} relative z-10`}>
            <div className="absolute -inset-1 bg-white/20 rounded-full blur-[2px]"></div>
          </div>
          {/* Distance Label */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-xs font-bold px-2 py-1 rounded border border-slate-700 text-slate-200 shadow-lg whitespace-nowrap z-20">
            {percentage}% ({feet !== null ? `~${feet} ft` : '...'}) {isHotter ? '🔥' : isColder ? '❄️' : ''}
          </div>
        </motion.div>
      )}

      {/* Center Point */}
      <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_#3b82f6] z-20 flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  );
};

const CameraView = ({ percentage, trendValue }: { percentage: number, trendValue: number }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCam = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported in this browser or context (HTTPS is required).");
        }
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        } catch (e) {
          console.warn("Failed to get environment camera, falling back to any camera", e);
          // Fallback if environment camera fails
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        if (!isMounted) {
          // If unmounted while waiting for the camera, stop it immediately
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        if (isMounted) {
          setCamError(err.message || "Camera access denied or unavailable.");
        }
      }
    };
    startCam();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Color shifts from red (far) to yellow (medium) to green (close)
  const getColorClass = () => {
    if (percentage < 30) return 'text-red-500';
    if (percentage < 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getPulseDuration = () => {
    if (percentage < 30) return 2;
    if (percentage < 70) return 1;
    return 0.5;
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {camError ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col space-y-4 p-6 text-center">
          <Camera size={48} className="opacity-50" />
          <p>{camError}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* AR Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Dynamic scaling based on signal strength */}
        <motion.div
          animate={{ 
            scale: [0.8 + (percentage / 100) * 0.5, 1 + (percentage / 100) * 0.5, 0.8 + (percentage / 100) * 0.5], 
            opacity: [0.5, 1, 0.5] 
          }}
          transition={{ duration: getPulseDuration(), repeat: Infinity }}
          className={`relative flex items-center justify-center ${getColorClass()} transition-colors duration-500`}
        >
          <Crosshair size={160} strokeWidth={1} />
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-bold bg-black/40 px-4 py-1 rounded-xl backdrop-blur-md">
              {percentage}%
            </span>
            {trendValue > 0.5 && <span className="text-2xl mt-2">🔥</span>}
            {trendValue < -0.5 && <span className="text-2xl mt-2">❄️</span>}
            <span className="text-xs font-medium mt-2 bg-black/40 px-2 py-1 rounded backdrop-blur-md uppercase tracking-widest">
              Signal
            </span>
          </div>
        </motion.div>
        
        {/* Distance Estimate overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Est. Distance</p>
          <p className={`text-2xl font-bold ${getColorClass()}`}>
            {percentage === 0 ? 'Out of range' : percentage < 30 ? '> 10 meters' : percentage < 70 ? '2 - 10 meters' : '< 2 meters'}
          </p>
        </div>
      </div>

      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-10 opacity-20"></div>
    </div>
  );
};

const SmartThingsModal = ({ onClose, onSelectDevice }: { onClose: () => void, onSelectDevice: (device: any, pat: string) => void }) => {
  // ... (existing SmartThingsModal code) ...
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState('');

  const fetchDevices = async () => {
    if (!pat) {
      setError("Please enter a Personal Access Token");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://api.smartthings.com/v1/devices', {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setDevices(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-left max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Cloud className="text-cyan-400" />
            <span>SmartThings API</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4 text-sm text-slate-300 overflow-y-auto custom-scrollbar pr-2 flex-1">
          <p>
            Enter a SmartThings Personal Access Token (PAT) to fetch your devices and their last known locations.
            You can generate one at <a href="https://account.smartthings.com/tokens" target="_blank" rel="noreferrer" className="text-cyan-400 underline">account.smartthings.com/tokens</a>.
          </p>
          
          <div className="space-y-2">
            <input 
              type="password" 
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Enter PAT here..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
            />
            <button 
              onClick={fetchDevices}
              disabled={loading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
            >
              {loading ? 'Fetching...' : 'Fetch Devices'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {devices.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold text-white">Your Devices ({devices.length})</h4>
              {devices.map(d => (
                <div key={d.deviceId} className="p-3 bg-slate-800 rounded-lg border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-200">{d.label || d.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Type: {d.deviceTypeName || 'Unknown'}</p>
                  </div>
                  <button 
                    onClick={() => onSelectDevice(d, pat)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const RadarSettingsModal = ({ settings, onSave, onClose }: { settings: RadarSettings, onSave: (s: RadarSettings) => void, onClose: () => void }) => {
  const [localSettings, setLocalSettings] = useState<RadarSettings>(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-left"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Settings size={20} className="text-blue-400" />
            <span>Radar Settings</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Blip Color */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Blip Color</label>
            <div className="flex space-x-3">
              {['green', 'blue', 'purple', 'yellow'].map(color => (
                <button
                  key={color}
                  onClick={() => setLocalSettings({ ...localSettings, blipColor: color })}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    localSettings.blipColor === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                  } bg-${color}-500`}
                  style={{ backgroundColor: color === 'green' ? '#22c55e' : color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : '#eab308' }}
                />
              ))}
            </div>
          </div>

          {/* Sweep Speed */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sweep Speed (Seconds)</label>
            <input 
              type="range" 
              min="1" max="8" step="1"
              value={localSettings.sweepSpeed}
              onChange={(e) => setLocalSettings({ ...localSettings, sweepSpeed: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Fast (1s)</span>
              <span>{localSettings.sweepSpeed}s</span>
              <span>Slow (8s)</span>
            </div>
          </div>

          {/* Concentric Circles */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Concentric Circles</label>
            <input 
              type="range" 
              min="1" max="8" step="1"
              value={localSettings.circleCount}
              onChange={(e) => setLocalSettings({ ...localSettings, circleCount: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span>{localSettings.circleCount}</span>
              <span>8</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => { onSave(localSettings); onClose(); }}
          className="w-full mt-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
        >
          Save Changes
        </button>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [device, setDevice] = useState<any>(null);
  const [rssi, setRssi] = useState<number | null>(null);
  const [rssiHistory, setRssiHistory] = useState<number[]>([]);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<'radar' | 'camera'>('radar');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<string>('');
  const [savedDevices, setSavedDevices] = useState<any[]>([]);
  const [manualSavedDevices, setManualSavedDevices] = useState<any[]>([]);
  const [fetchedDeviceName, setFetchedDeviceName] = useState<string | null>(null);
  const [fallbackDeviceName, setFallbackDeviceName] = useState<string | null>(null);
  const [showSmartThings, setShowSmartThings] = useState(false);
  const [stDevice, setStDevice] = useState<any>(null);
  const [stPat, setStPat] = useState<string>('');
  const [stStatus, setStStatus] = useState<string>('');
  const [radarSettings, setRadarSettings] = useState<RadarSettings>({
    blipColor: 'green',
    sweepSpeed: 3,
    circleCount: 4
  });
  const [showRadarSettings, setShowRadarSettings] = useState(false);
  const lastSeenRef = useRef<number | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [cordovaDevices, setCordovaDevices] = useState<any[]>([]);
  const [showCordovaPicker, setShowCordovaPicker] = useState(false);

  useEffect(() => {
    if (isCordova) {
      document.addEventListener('deviceready', () => {
        console.log("Cordova is ready!");
      }, false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('customDeviceNames');
    if (stored) {
      try {
        setCustomNames(JSON.parse(stored));
      } catch (e) {}
    }
    const storedManual = localStorage.getItem('manualSavedDevices');
    if (storedManual) {
      try {
        setManualSavedDevices(JSON.parse(storedManual));
      } catch (e) {}
    }
  }, []);

  const handleRename = () => {
    if (!device || !device.id) return;
    const currentName = customNames[device.id] || fetchedDeviceName || device.name || fallbackDeviceName || 'Unknown Device';
    const newName = prompt('Enter a name for this device:', currentName);
    if (newName !== null && newName.trim() !== '') {
      const name = newName.trim();
      const updated = { ...customNames, [device.id]: name };
      setCustomNames(updated);
      localStorage.setItem('customDeviceNames', JSON.stringify(updated));
      
      // Also save to manual list for easy find
      const manual = [...manualSavedDevices];
      const existingIdx = manual.findIndex(d => d.id === device.id);
      const deviceData = {
        id: device.id,
        name: device.name || fallbackDeviceName,
        customName: name,
        lastSeen: Date.now()
      };
      if (existingIdx >= 0) {
        manual[existingIdx] = deviceData;
      } else {
        manual.push(deviceData);
      }
      setManualSavedDevices(manual);
      localStorage.setItem('manualSavedDevices', JSON.stringify(manual));
    }
  };

  useEffect(() => {
    if (!device) return;
    const interval = setInterval(() => {
      // Increase timeout to 15 seconds before decaying to prevent "wandering off" when pings are slow
      if (lastSeenRef.current && Date.now() - lastSeenRef.current > 15000) {
        setRssi(prev => {
          if (prev === null) return null;
          const decayed = prev - 1; // drop slower
          if (decayed < -105) return null;
          return decayed;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [device]);

  useEffect(() => {
    const loadSavedDevices = async () => {
      const nav = navigator as any;
      if (nav.bluetooth && nav.bluetooth.getDevices) {
        try {
          const devices = await nav.bluetooth.getDevices();
          setSavedDevices(devices);
        } catch (e) {
          console.error("Could not load saved devices", e);
        }
      }
    };
    loadSavedDevices();
  }, []);

  const connectGattWithRetry = async (btDevice: any, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`GATT connection attempt ${i + 1}...`);
        const server = await btDevice.gatt.connect();
        return server;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const fetchDeviceName = async (server: any) => {
    try {
      // Try Standard Generic Access -> Device Name
      const service = await server.getPrimaryService('generic_access');
      const char = await service.getCharacteristic(0x2a00);
      const val = await char.readValue();
      return new TextDecoder().decode(val);
    } catch (e1) {
      try {
        // Try Device Information -> Model Number String
        const infoService = await server.getPrimaryService('device_information');
        const modelChar = await infoService.getCharacteristic(0x2a24);
        const val = await modelChar.readValue();
        return new TextDecoder().decode(val);
      } catch (e2) {
        try {
          // Try custom FFE0/FFE1 characteristic as requested by user
          const customService = await server.getPrimaryService(0xffe0);
          const customChar = await customService.getCharacteristic(0xffe1);
          const val = await customChar.readValue();
          return new TextDecoder().decode(val);
        } catch (e3) {
          return null;
        }
      }
    }
  };

  const connectToSavedDevice = async (btDevice: any) => {
    try {
      setError('');
      setIsScanning(true);
      setFetchedDeviceName(null);
      setFallbackDeviceName(btDevice.name || null);
      setDevice(btDevice);

      if ('watchAdvertisements' in btDevice) {
        if (btDevice._advHandler) {
          btDevice.removeEventListener('advertisementreceived', btDevice._advHandler);
        }
        btDevice._advHandler = (event: any) => {
          lastSeenRef.current = Date.now();
          setRssi(prev => {
            if (prev === null) return event.rssi;
            // Dynamic alpha: fast response for big changes, smooth for small changes
            const diff = Math.abs(event.rssi - prev);
            const alpha = diff > 10 ? 0.8 : diff > 5 ? 0.4 : 0.15;
            return (event.rssi * alpha) + (prev * (1 - alpha));
          });
          setRssiHistory(prev => {
            const newHistory = [...prev, event.rssi];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
          });
        };
        btDevice.addEventListener('advertisementreceived', btDevice._advHandler);
        await btDevice.watchAdvertisements();
      }

      if (btDevice.gatt) {
        try {
          const server = await connectGattWithRetry(btDevice);
          setIsConnected(true);
          if (btDevice._disconnectHandler) {
            btDevice.removeEventListener('gattserverdisconnected', btDevice._disconnectHandler);
          }
          btDevice._disconnectHandler = () => {
             setIsConnected(false);
          };
          btDevice.addEventListener('gattserverdisconnected', btDevice._disconnectHandler);
          
          if (!btDevice.name) {
            const name = await fetchDeviceName(server);
            if (name) setFetchedDeviceName(name);
          }
        } catch (gattErr) {
          console.warn("Could not connect to GATT server:", gattErr);
        }
      }
    } catch (err: any) {
      setError(`Failed to connect to saved device: ${err.message}`);
      setDevice(null);
    } finally {
      setIsScanning(false);
    }
  };

  const startNFCScan = async () => {
    if (isCordova && (window as any).nfc) {
      const nfc = (window as any).nfc;
      setNfcStatus("Scanning for NFC tags... Hold device near tag.");
      nfc.addNdefListener(
        (event: any) => {
          const tag = event.tag;
          let text = "Tag found! ID: " + nfc.bytesToHexString(tag.id);
          let extractedData = "";
          if (tag.ndefMessage && tag.ndefMessage.length > 0) {
            const record = tag.ndefMessage[0];
            extractedData = nfc.decodeMessage([record]);
            text += ` | Data: ${extractedData}`;
          }
          if (extractedData) {
            setNfcStatus(`${text}. Initiating Bluetooth scan...`);
            setTimeout(() => startScan('nfc', extractedData), 1500);
          } else {
            setNfcStatus(text);
          }
        },
        () => console.log("NFC listener added"),
        (err: any) => setError(`NFC Error: ${err}`)
      );
      return;
    }

    if (!('NDEFReader' in window)) {
      setError("NFC is not supported on this device or browser. Try Chrome on Android.");
      return;
    }
    
    try {
      setError('');
      setNfcStatus("Scanning for NFC tags... Hold device near tag.");
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      
      ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
        let text = "Tag found! Serial: " + serialNumber;
        let extractedData = "";
        if (message.records && message.records.length > 0) {
          try {
            const record = message.records[0];
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            extractedData = textDecoder.decode(record.data);
            text += ` | Data: ${extractedData}`;
          } catch (e) {
            text += " | (Could not decode text data)";
          }
        }
        
        if (extractedData) {
          setNfcStatus(`${text}. Initiating Bluetooth scan for this device...`);
          // Automatically trigger a scan using the extracted data as a hint
          setTimeout(() => {
            startScan('nfc', extractedData);
          }, 1500);
        } else {
          setNfcStatus(text);
        }
      });
      
      ndef.addEventListener("readingerror", () => {
        setError("Error reading NFC tag. Try again.");
        setNfcStatus('');
      });
    } catch (err: any) {
      setError(`NFC Error: ${err.message}`);
      setNfcStatus('');
    }
  };

  const startScan = async (filterType: FilterType | 'nfc' | 'smartthings' = 'all', hintData?: string) => {
    if (isCapacitor && (window as any).Capacitor?.Plugins?.BluetoothLe) {
      const ble = (window as any).Capacitor.Plugins.BluetoothLe;
      try {
        setError('');
        setIsScanning(true);
        
        // Ensure enabled
        const enabled = await ble.isEnabled();
        if (!enabled.value) {
          await ble.enable();
        }

        // Request device (shows native picker)
        const device = await ble.requestDevice({
          services: [], // Scan for all
        });

        if (device) {
          // Map Capacitor device to our internal format
          const mappedDevice = {
            id: device.deviceId,
            name: device.name || 'Unknown Device',
            gatt: {
              connect: async () => {
                await ble.connect({ deviceId: device.deviceId });
                return {
                  getPrimaryService: async (uuid: string) => ({
                    getCharacteristic: async (charUuid: string) => ({
                      readValue: async () => {
                        const result = await ble.read({ deviceId: device.deviceId, service: uuid, characteristic: charUuid });
                        return new Uint8Array(atob(result.value).split('').map(c => c.charCodeAt(0))).buffer;
                      }
                    })
                  })
                };
              }
            },
            watchAdvertisements: async () => {
              await ble.startScanning({
                services: [],
                allowDuplicates: true,
              });
              
              // Listen for scan results
              ble.addListener('onScanResult', (result: any) => {
                if (result.device.deviceId === device.deviceId) {
                  lastSeenRef.current = Date.now();
                  setRssi(prev => {
                    if (prev === null) return result.rssi;
                    const diff = Math.abs(result.rssi - prev);
                    const alpha = diff > 10 ? 0.8 : diff > 5 ? 0.4 : 0.15;
                    return (result.rssi * alpha) + (prev * (1 - alpha));
                  });
                }
              });
            }
          };
          
          setDevice(mappedDevice);
          await (mappedDevice as any).watchAdvertisements();
        }
      } catch (err: any) {
        setError(`Capacitor BLE Error: ${err.message || err}`);
      } finally {
        setIsScanning(false);
      }
      return;
    }

    if (isCordova && (window as any).ble) {
      const ble = (window as any).ble;
      setError('');
      setIsScanning(true);
      setCordovaDevices([]);
      setShowCordovaPicker(true);

      ble.startScan([], (device: any) => {
        setCordovaDevices(prev => {
          if (prev.find(d => d.id === device.id)) return prev;
          // Apply basic filtering for Cordova
          if (filterType === 'samsung' && !device.name?.toLowerCase().includes('samsung') && !device.name?.toLowerCase().includes('smarttag')) return prev;
          if (filterType === 'apple' && !device.name?.toLowerCase().includes('apple')) return prev;
          if (filterType === 'tile' && !device.name?.toLowerCase().includes('tile')) return prev;
          
          return [...prev, device];
        });
      }, (err: any) => {
        setError(`Cordova BLE Error: ${err}`);
        setIsScanning(false);
      });

      // Stop scan after 10 seconds
      setTimeout(() => {
        ble.stopScan();
        setIsScanning(false);
      }, 10000);
      return;
    }

    const nav = navigator as any;
    if (!nav.bluetooth) {
      setError("Web Bluetooth is not supported in this browser. If you are on iOS, Safari does NOT support Web Bluetooth (you must use a specialized app like WebBLE or Bluefy). On Android, use Chrome.");
      return;
    }

    try {
      setError('');
      if (filterType !== 'nfc') setNfcStatus('');
      setIsScanning(true);
      setFetchedDeviceName(null);
      
      if (filterType === 'samsung') setFallbackDeviceName('Samsung SmartTag');
      else if (filterType === 'apple') setFallbackDeviceName('Apple AirTag');
      else if (filterType === 'tile') setFallbackDeviceName('Tile Tracker');
      else setFallbackDeviceName('Unknown Device');
      
      let requestOptions: any = {
        optionalServices: ['generic_access', 'battery_service', 'device_information'] // Common services to allow connection
      };

      if (filterType !== 'all') {
        requestOptions.filters = [];
        
        if (filterType === 'samsung') {
          requestOptions.filters.push(
            { namePrefix: 'SmartTag2' },
            { namePrefix: 'SmartTag' },
            { namePrefix: 'Galaxy' },
            { namePrefix: 'Tag' },
            { namePrefix: 'Samsung' },
            { manufacturerData: [{ companyIdentifier: 0x0075 }] } // Samsung Electronics
          );
        } else if (filterType === 'apple') {
          requestOptions.filters.push(
            { manufacturerData: [{ companyIdentifier: 0x004c }] } // Apple Inc.
          );
        } else if (filterType === 'tile') {
          requestOptions.filters.push(
            { services: [0xfeed] }, // Tile service UUID
            { namePrefix: 'Tile' }
          );
          requestOptions.optionalServices.push(0xfeed);
        } else if (filterType === 'smartthings') {
          // SmartThings custom labels don't match BLE broadcast names, so we just look for Samsung tags generally
          requestOptions.filters.push(
            { namePrefix: 'SmartTag2' },
            { namePrefix: 'SmartTag' },
            { namePrefix: 'Galaxy' },
            { namePrefix: 'Tag' },
            { namePrefix: 'Samsung' },
            { manufacturerData: [{ companyIdentifier: 0x0075 }] }
          );
        } else if (filterType === 'nfc' && hintData) {
          // Try to use the hint data as a name prefix.
          const cleanData = hintData.substring(0, 20); // Keep it short to avoid complex filter errors
          requestOptions.filters.push({ namePrefix: cleanData });
        }
      } else {
        requestOptions.acceptAllDevices = true;
      }

      let btDevice;
      try {
        btDevice = await nav.bluetooth.requestDevice(requestOptions);
      } catch (err: any) {
        // If complex filters fail (e.g., browser doesn't support manufacturerData filtering, or NFC data was a bad filter), fallback to all devices
        if (err.name === 'TypeError' && filterType !== 'all') {
          console.warn("Complex filters failed, falling back to acceptAllDevices", err);
          requestOptions = { acceptAllDevices: true, optionalServices: ['generic_access', 'battery_service', 'device_information'] };
          if (filterType === 'tile') requestOptions.optionalServices.push(0xfeed);
          btDevice = await nav.bluetooth.requestDevice(requestOptions);
        } else {
          throw err;
        }
      }

      setDevice(btDevice);

      // Listen for advertisement packets to get RSSI
      if ('watchAdvertisements' in btDevice) {
        if (btDevice._advHandler) {
          btDevice.removeEventListener('advertisementreceived', btDevice._advHandler);
        }
        btDevice._advHandler = (event: any) => {
          lastSeenRef.current = Date.now();
          setRssi(prev => {
            if (prev === null) return event.rssi;
            // Dynamic alpha: fast response for big changes, smooth for small changes
            const diff = Math.abs(event.rssi - prev);
            const alpha = diff > 10 ? 0.8 : diff > 5 ? 0.4 : 0.15;
            return (event.rssi * alpha) + (prev * (1 - alpha));
          });
          setRssiHistory(prev => {
            const newHistory = [...prev, event.rssi];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
          });
        };
        btDevice.addEventListener('advertisementreceived', btDevice._advHandler);
        await btDevice.watchAdvertisements();
      } else {
        setError("Your browser does not support continuous signal tracking (watchAdvertisements). You must enable the 'Experimental Web Platform features' flag in chrome://flags to use the radar.");
      }

      // Attempt to connect to GATT Server for persistent connection
      if (btDevice.gatt) {
        try {
          const server = await connectGattWithRetry(btDevice);
          setIsConnected(true);
          if (btDevice._disconnectHandler) {
            btDevice.removeEventListener('gattserverdisconnected', btDevice._disconnectHandler);
          }
          btDevice._disconnectHandler = () => {
             setIsConnected(false);
          };
          btDevice.addEventListener('gattserverdisconnected', btDevice._disconnectHandler);
          
          if (!btDevice.name) {
            const name = await fetchDeviceName(server);
            if (name) setFetchedDeviceName(name);
          }
        } catch (gattErr) {
          console.warn("Could not connect to GATT server (this is normal for some devices):", gattErr);
        }
      }

    } catch (err: any) {
      const errMsg = err.message || String(err);
      // User cancelling the picker throws an error, we can ignore it
      if (err.name !== 'NotFoundError' && err.name !== 'NotAllowedError' && !errMsg.toLowerCase().includes('cancel')) {
        console.error(err);
        setError(errMsg || "Failed to connect to device.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const connectToCordovaDevice = (device: any) => {
    const ble = (window as any).ble;
    setShowCordovaPicker(false);
    setIsScanning(false);
    setDevice(device);
    
    ble.connect(device.id, (connectedDevice: any) => {
      setIsConnected(true);
      // Start RSSI polling for Cordova
      const rssiInterval = setInterval(() => {
        ble.readRSSI(device.id, (rssi: number) => {
          lastSeenRef.current = Date.now();
          setRssi(prev => {
            if (prev === null) return rssi;
            const diff = Math.abs(rssi - prev);
            const alpha = diff > 10 ? 0.8 : diff > 5 ? 0.4 : 0.15;
            return (rssi * alpha) + (prev * (1 - alpha));
          });
          setRssiHistory(prev => {
            const newHistory = [...prev, rssi];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
          });
        }, (err: any) => console.warn("RSSI read failed", err));
      }, 1000);

      device._rssiInterval = rssiInterval;
    }, (err: any) => {
      setIsConnected(false);
      setError(`Cordova Connection Error: ${err}`);
      setDevice(null);
      if (device._rssiInterval) clearInterval(device._rssiInterval);
    });
  };

  const disconnect = () => {
    if (isCordova && (window as any).ble && device) {
      (window as any).ble.disconnect(device.id);
      if (device._rssiInterval) clearInterval(device._rssiInterval);
    } else if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    setDevice(null);
    setRssi(null);
    setRssiHistory([]);
    setFetchedDeviceName(null);
    setFallbackDeviceName(null);
    setMode('radar');
    setError('');
  };

  const getTrendValue = (): number => {
    if (rssiHistory.length < 5) return 0;
    const recent = rssiHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, rssiHistory.length);
    const older = rssiHistory.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, rssiHistory.length - 5);
    return recent - older;
  };

  const currentTrendValue = getTrendValue();

  const handleSelectSmartThingsDevice = (device: any, pat: string) => {
    setStDevice(device);
    setStPat(pat);
    setShowSmartThings(false);
    setStStatus('Ready');
  };

  const ringSmartThingsDevice = async () => {
    if (!stDevice || !stPat) return;
    setStStatus('Ringing...');
    
    const commandsToTry = [
      { component: 'main', capability: 'tone', command: 'beep' },
      { component: 'main', capability: 'chime', command: 'chime' },
      { component: 'main', capability: 'audioNotification', command: 'playTrack', arguments: ["https://www.soundjay.com/buttons/beep-01a.mp3"] },
      { component: 'main', capability: 'alarm', command: 'siren' },
      { component: 'main', capability: 'switch', command: 'on' },
      { component: 'main', capability: 'execute', command: 'execute', arguments: ["ring"] }
    ];

    let success = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    for (const cmd of commandsToTry) {
      try {
        const response = await fetch(`https://api.smartthings.com/v1/devices/${stDevice.deviceId}/commands`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stPat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ commands: [cmd] }),
          signal: controller.signal
        });
        if (response.ok) {
          success = true;
          break;
        }
      } catch (e: any) {
        // ignore and try next
      }
    }
    clearTimeout(timeoutId);

    if (success) {
      setStStatus('Ring command sent!');
      setTimeout(() => setStStatus('Ready'), 3000);
    } else {
      setStStatus('Failed to ring device (unsupported capability)');
    }
  };

  const fetchSmartThingsStatus = async () => {
    if (!stDevice || !stPat) return;
    setStStatus('Fetching status...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://api.smartthings.com/v1/devices/${stDevice.deviceId}/status`, {
        headers: {
          'Authorization': `Bearer ${stPat}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Status fetch failed');
      const data = await response.json();
      
      // Try to find presence or location
      let statusText = 'Status updated';
      if (data.components?.main?.presenceSensor?.presence?.value) {
        statusText = `Presence: ${data.components.main.presenceSensor.presence.value}`;
      }
      if (data.components?.main?.battery?.battery?.value) {
        statusText += ` | Battery: ${data.components.main.battery.battery.value}%`;
      }
      setStStatus(statusText);
    } catch (e: any) {
      setStStatus('Failed to fetch status (Timeout or API Error)');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const connectToManualDevice = async (devData: any) => {
    // For manual devices, we still need to request them because the browser session might have expired
    // but we can use the ID as a hint.
    startScan('all', devData.name);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center space-x-3 text-blue-400">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Bluetooth size={20} />
          </div>
          <span className="font-bold text-lg tracking-wide text-slate-100">Where am i?</span>
        </div>
        <div className="flex items-center space-x-2">
          {device && mode === 'radar' && (
            <button 
              onClick={() => setShowRadarSettings(true)}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors bg-slate-900 rounded-full"
              title="Radar Settings"
            >
              <Settings size={20} />
            </button>
          )}
          {device && (
            <button 
              onClick={disconnect} 
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-slate-900 rounded-full"
              title="Disconnect"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {showCordovaPicker && (
          <div className="fixed inset-0 z-[60] bg-slate-950 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Select Device</h2>
              <button onClick={() => { setShowCordovaPicker(false); (window as any).ble?.stopScan(); }} className="p-2 text-slate-400 bg-slate-900 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {cordovaDevices.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <RadarIcon size={40} className="opacity-20" />
                  </motion.div>
                  <p className="mt-4">Scanning for nearby devices...</p>
                </div>
              )}
              {cordovaDevices.map((dev, i) => (
                <button
                  key={i}
                  onClick={() => connectToCordovaDevice(dev)}
                  className="w-full flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="overflow-hidden">
                    <p className="font-bold text-slate-100 truncate">{dev.name || 'Unknown Device'}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">{dev.id}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-4">
                    <span className="text-blue-400 font-bold">{dev.rssi} dBm</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-tighter">Signal</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!device && !stDevice ? (
          <WelcomeScreen 
            onStart={startScan} 
            onNfcStart={startNFCScan} 
            onSmartThingsStart={() => setShowSmartThings(true)} 
            isScanning={isScanning} 
            error={error} 
            nfcStatus={nfcStatus} 
            savedDevices={savedDevices} 
            manualSavedDevices={manualSavedDevices}
            onConnectSaved={connectToSavedDevice} 
            onConnectManual={connectToManualDevice}
            customNames={customNames} 
          />
        ) : stDevice && !device ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Cloud size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{stDevice.label || stDevice.name}</h2>
            <p className="text-slate-400 mb-8">SmartThings Device</p>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 w-full max-w-sm mb-8">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Status</p>
              <p className="font-medium text-cyan-400">{stStatus}</p>
            </div>

            <div className="flex flex-col w-full max-w-sm space-y-3">
              <button 
                onClick={() => {
                  setStDevice(null);
                  startScan('smartthings', stDevice.label || stDevice.name);
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2"
              >
                <RadarIcon size={24} />
                <span>Track via Bluetooth</span>
              </button>
              <button 
                onClick={ringSmartThingsDevice}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold text-lg transition-all active:scale-95 shadow-lg shadow-cyan-900/20"
              >
                Ring Device
              </button>
              <button 
                onClick={fetchSmartThingsStatus}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all active:scale-95"
              >
                Refresh Status
              </button>
              <button 
                onClick={() => setStDevice(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-medium transition-all active:scale-95 mt-4"
              >
                Back to Scanner
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            {/* Top Stats Bar */}
            <div className="p-4 flex items-center justify-between bg-slate-900/40 border-b border-slate-800/60 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5 flex items-center space-x-2">
                    <span>Target Device</span>
                    {isConnected && <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[10px]">GATT Connected</span>}
                  </p>
                  <p className="font-medium text-slate-200 truncate max-w-[150px] sm:max-w-xs flex items-center space-x-2">
                    <span>{customNames[device.id] || fetchedDeviceName || device.name || fallbackDeviceName || 'Unknown Device'}</span>
                    <button onClick={handleRename} className="text-slate-400 hover:text-white transition-colors flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded text-xs" title="Save / Rename Device">
                      <Edit2 size={12} />
                      <span>{customNames[device.id] ? 'Rename' : 'Save'}</span>
                    </button>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Signal (RSSI)</p>
                <p className="font-mono font-medium text-slate-200">
                  {rssi !== null ? `${Math.round(rssi)} dBm` : 'Scanning...'}
                </p>
              </div>
            </div>

            {/* View Area */}
            <div className="flex-1 relative p-4 sm:p-8 flex items-center justify-center overflow-hidden">
              {mode === 'radar' ? (
                <RadarView percentage={calculateSignalPercentage(rssi)} rssi={rssi} trendValue={currentTrendValue} settings={radarSettings} />
              ) : (
                <CameraView percentage={calculateSignalPercentage(rssi)} trendValue={currentTrendValue} />
              )}
            </div>

            {/* Bottom Navigation */}
            <div className="p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800/60 flex space-x-4 pb-safe">
              <button
                onClick={() => setMode('radar')}
                className={`flex-1 py-4 rounded-2xl flex items-center justify-center space-x-2 font-semibold transition-all ${
                  mode === 'radar' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <RadarIcon size={20} />
                <span>Radar Map</span>
              </button>
              <button
                onClick={() => setMode('camera')}
                className={`flex-1 py-4 rounded-2xl flex items-center justify-center space-x-2 font-semibold transition-all ${
                  mode === 'camera' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Camera size={20} />
                <span>AR Camera</span>
              </button>
            </div>
          </div>
        )}
      </main>
      
      {showSmartThings && <SmartThingsModal onClose={() => setShowSmartThings(false)} onSelectDevice={handleSelectSmartThingsDevice} />}
      {showRadarSettings && <RadarSettingsModal settings={radarSettings} onSave={setRadarSettings} onClose={() => setShowRadarSettings(false)} />}
    </div>
  );
}

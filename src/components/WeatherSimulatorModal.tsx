import React, { useState } from 'react';
import { CityConditions } from '../types';
import {
  X,
  Sliders,
  Thermometer,
  Droplets,
  CloudRain,
  RotateCcw,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface WeatherSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  conditions: CityConditions;
  onApplySimulation: (tempOffset: number, humidityOffset: number, rainOffset: number) => void;
  onReset: () => void;
  isSimulated: boolean;
}

export const WeatherSimulatorModal: React.FC<WeatherSimulatorModalProps> = ({
  isOpen,
  onClose,
  conditions,
  onApplySimulation,
  onReset,
  isSimulated,
}) => {
  const [tempOffset, setTempOffset] = useState<number>(0);
  const [humidityOffset, setHumidityOffset] = useState<number>(0);
  const [rainOffset, setRainOffset] = useState<number>(0);

  if (!isOpen) return null;

  const simulatedTemp = conditions.temperature + tempOffset;
  const simulatedHumidity = Math.min(100, Math.max(20, conditions.humidity + humidityOffset));
  const simulatedRain = Math.max(0, conditions.rainfall + rainOffset);

  const handleApply = () => {
    onApplySimulation(tempOffset, humidityOffset, rainOffset);
    onClose();
  };

  const handleReset = () => {
    setTempOffset(0);
    setHumidityOffset(0);
    setRainOffset(0);
    onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#F7F4EC] border-2 border-[#1F3D2E] rounded-xs shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1F3D2E] text-[#EDE6D6] p-4 border-b-2 border-[#14291F] flex items-center justify-between relative">
          <div className="w-full h-1 absolute top-0 left-0 aedes-stripe-accent" />
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#D9A441]" />
            <h2 className="font-heading font-extrabold text-base uppercase text-white tracking-wide">
              Weather & Microclimate Simulator
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#EDE6D6]/70 hover:text-white bg-[#14291F] rounded-xs border border-[#2D5843]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs font-sans">
          
          <div className="bg-[#EDE6D6] p-3 rounded-xs border border-[#DDD3C1] text-[#23241F] leading-relaxed">
            <p className="font-bold font-heading text-xs uppercase mb-1 flex items-center gap-1.5 text-[#1F3D2E]">
              <AlertTriangle className="w-4 h-4 text-[#D9A441]" />
              <span>What-If Field Scenario Modelling</span>
            </p>
            Adjust environmental parameters to predict how a sudden monsoon rain spike or heatwave would shift mosquito biting activity scores across Islamabad zones.
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5 bg-white p-3 rounded-xs border border-[#DDD3C1]">
            <div className="flex items-center justify-between font-mono-data">
              <span className="font-bold text-[#1F3D2E] flex items-center gap-1.5 font-heading uppercase text-xs">
                <Thermometer className="w-4 h-4 text-[#D9A441]" /> Temperature Offset
              </span>
              <span className="font-bold text-sm text-[#23241F]">
                {simulatedTemp.toFixed(1)}°C ({tempOffset >= 0 ? `+${tempOffset.toFixed(1)}` : tempOffset.toFixed(1)}°C)
              </span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.5"
              value={tempOffset}
              onChange={(e) => setTempOffset(parseFloat(e.target.value))}
              className="w-full accent-[#1F3D2E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-[#5C5E54]">
              <span>-5.0°C (Cooling)</span>
              <span>Baseline ({conditions.temperature}°C)</span>
              <span>+5.0°C (Heatwave)</span>
            </div>
          </div>

          {/* Humidity Slider */}
          <div className="space-y-1.5 bg-white p-3 rounded-xs border border-[#DDD3C1]">
            <div className="flex items-center justify-between font-mono-data">
              <span className="font-bold text-[#1F3D2E] flex items-center gap-1.5 font-heading uppercase text-xs">
                <Droplets className="w-4 h-4 text-sky-600" /> Humidity Offset
              </span>
              <span className="font-bold text-sm text-sky-700">
                {simulatedHumidity}% ({humidityOffset >= 0 ? `+${humidityOffset}` : humidityOffset}%)
              </span>
            </div>
            <input
              type="range"
              min="-25"
              max="25"
              step="1"
              value={humidityOffset}
              onChange={(e) => setHumidityOffset(parseInt(e.target.value))}
              className="w-full accent-sky-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-[#5C5E54]">
              <span>-25% (Dry Air)</span>
              <span>Baseline ({conditions.humidity}%)</span>
              <span>+25% (High Humidity)</span>
            </div>
          </div>

          {/* Rainfall Slider */}
          <div className="space-y-1.5 bg-white p-3 rounded-xs border border-[#DDD3C1]">
            <div className="flex items-center justify-between font-mono-data">
              <span className="font-bold text-[#1F3D2E] flex items-center gap-1.5 font-heading uppercase text-xs">
                <CloudRain className="w-4 h-4 text-blue-600" /> Recent Rain Offset
              </span>
              <span className="font-bold text-sm text-blue-800">
                {simulatedRain.toFixed(1)} mm ({rainOffset >= 0 ? `+${rainOffset}` : rainOffset}mm)
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="40"
              step="2"
              value={rainOffset}
              onChange={(e) => setRainOffset(parseInt(e.target.value))}
              className="w-full accent-blue-800 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-[#5C5E54]">
              <span>Dry spell</span>
              <span>Baseline ({conditions.rainfall}mm)</span>
              <span>+40mm Monsoon Downpour</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#DDD3C1]">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#EDE6D6] hover:bg-[#DDD3C1] text-[#23241F] rounded-xs font-heading font-bold text-xs uppercase border border-[#DDD3C1] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Scenario</span>
            </button>

            <button
              onClick={handleApply}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#D9A441] hover:bg-[#c49233] text-[#23241F] rounded-xs font-heading font-extrabold text-xs uppercase transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Recalculate Zone Risks Now</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

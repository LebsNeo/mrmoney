"use client";

import { useState, useTransition } from "react";
import { createPropertyFromOnboarding } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────

interface RoomData {
  name: string;
  type: string;
  baseRate: number;
}

interface OTAData {
  platform: string;
  commission: number;
  selected: boolean;
}

const PROPERTY_TYPES = ["Guesthouse", "Hotel", "Lodge", "Boutique", "Airbnb Portfolio"];

const ROOM_TYPES = ["Single", "Double", "Twin", "Queen", "King", "Suite", "Dorm"];

const OTA_PLATFORMS: OTAData[] = [
  { platform: "Booking.com", commission: 15, selected: false },
  { platform: "Airbnb", commission: 3, selected: false },
  { platform: "Lekkerslaap", commission: 10, selected: false },
  { platform: "Expedia", commission: 15, selected: false },
  { platform: "Direct Only", commission: 0, selected: false },
];

const STEPS = ["Welcome", "Property", "Rooms", "Platforms", "Done!"];

// ─── Progress Bar ─────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step) / (total - 1)) * 100);
  return (
    <div className="w-full max-w-xl mb-8">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>Step {step + 1} of {total}</span>
        <span>{STEPS[step]}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-teal-700 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6 max-w-md">
      <div className="text-6xl mb-2">👋</div>
      <h1 className="text-3xl font-bold text-slate-900">Welcome to MrMoney</h1>
      <p className="text-slate-500 text-lg leading-relaxed">
        Let&apos;s set up your property in 4 quick steps. It takes less than 5 minutes.
      </p>
      <button
        onClick={onNext}
        className="w-full sm:w-auto px-10 py-4 rounded-2xl text-base font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors shadow-lg shadow-teal-700/20"
      >
        Let&apos;s Start →
      </button>
    </div>
  );
}

// ─── Step 2: Property ─────────────────────────

interface StepPropertyProps {
  propertyName: string;
  setPropertyName: (v: string) => void;
  propertyType: string;
  setPropertyType: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  vatRegistered: boolean;
  setVatRegistered: (v: boolean) => void;
  vatNumber: string;
  setVatNumber: (v: string) => void;
  onNext: () => void;
}

function StepProperty({
  propertyName, setPropertyName,
  propertyType, setPropertyType,
  city, setCity,
  vatRegistered, setVatRegistered,
  vatNumber, setVatNumber,
  onNext,
}: StepPropertyProps) {
  function canProceed() {
    return propertyName.trim() && propertyType && city.trim();
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Property</h2>
        <p className="text-slate-500">Tell us a bit about your property.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        {/* Property name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Property Name *</label>
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder="e.g. Sunset Guesthouse"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 transition"
          />
        </div>

        {/* Property type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Property Type *</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPropertyType(type)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  propertyType === type
                    ? "bg-teal-700 text-white border-teal-700"
                    : "bg-white text-slate-600 border-slate-200 hover:border-teal-700 hover:text-teal-700"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">City *</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Cape Town"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 transition"
          />
        </div>

        {/* VAT */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">VAT Registered?</p>
              <p className="text-xs text-slate-400">Required if your annual turnover exceeds R1M</p>
            </div>
            <button
              type="button"
              onClick={() => setVatRegistered(!vatRegistered)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                vatRegistered ? "bg-teal-700" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  vatRegistered && "translate-x-5"
                )}
              />
            </button>
          </div>

          {vatRegistered && (
            <div className="mt-3">
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="VAT Number (e.g. 4123456789)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 transition"
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed()}
        className="w-full py-3 rounded-2xl text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 3: Rooms ────────────────────────────

interface StepRoomsProps {
  rooms: RoomData[];
  setRooms: (rooms: RoomData[]) => void;
  onNext: () => void;
}

function StepRooms({ rooms, setRooms, onNext }: StepRoomsProps) {
  const [count, setCount] = useState(rooms.length || 1);

  function handleCountChange(newCount: number) {
    const clamp = Math.max(1, Math.min(50, newCount));
    setCount(clamp);
    const updated = Array.from({ length: clamp }, (_, i) => ({
      name: rooms[i]?.name ?? `Room ${i + 1}`,
      type: rooms[i]?.type ?? "Double",
      baseRate: rooms[i]?.baseRate ?? 0,
    }));
    setRooms(updated);
  }

  function updateRoom(idx: number, field: keyof RoomData, value: string | number) {
    const updated = rooms.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setRooms(updated);
  }

  function addRoom() {
    handleCountChange(count + 1);
  }

  function removeRoom(idx: number) {
    if (rooms.length <= 1) return;
    const updated = rooms.filter((_, i) => i !== idx);
    setCount(updated.length);
    setRooms(updated);
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Rooms</h2>
        <p className="text-slate-500">Tell us about your accommodation units.</p>
      </div>

      {/* Room count */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 flex-1">How many rooms do you have?</label>
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => handleCountChange(parseInt(e.target.value, 10) || 1)}
          className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700"
        />
      </div>

      {/* Room cards */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {rooms.map((room, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Room {idx + 1}</span>
              {rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRoom(idx)}
                  className="text-slate-400 hover:text-red-500 text-sm transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={room.name}
                  onChange={(e) => updateRoom(idx, "name", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select
                  value={room.type}
                  onChange={(e) => updateRoom(idx, "type", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 bg-white"
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Base Rate per Night (R)</label>
              <input
                type="number"
                min={0}
                value={room.baseRate || ""}
                onChange={(e) => updateRoom(idx, "baseRate", parseFloat(e.target.value) || 0)}
                placeholder="e.g. 850"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRoom}
        className="w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed border-slate-200 text-slate-400 hover:border-teal-700 hover:text-teal-700 transition-colors"
      >
        + Add Room
      </button>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-2xl text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 4: OTAs ─────────────────────────────

interface StepOTAsProps {
  otas: OTAData[];
  setOtas: (otas: OTAData[]) => void;
  onNext: () => void;
}

function StepOTAs({ otas, setOtas, onNext }: StepOTAsProps) {
  function toggleOTA(idx: number) {
    const updated = otas.map((o, i) => (i === idx ? { ...o, selected: !o.selected } : o));
    setOtas(updated);
  }

  function updateCommission(idx: number, value: number) {
    const updated = otas.map((o, i) => (i === idx ? { ...o, commission: value } : o));
    setOtas(updated);
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Booking Platforms</h2>
        <p className="text-slate-500">Which platforms are you on? Commission rates are shown and editable.</p>
      </div>

      <div className="space-y-3">
        {otas.map((ota, idx) => (
          <div
            key={ota.platform}
            className={cn(
              "bg-white border-2 rounded-2xl p-4 shadow-sm transition-all",
              ota.selected ? "border-teal-700" : "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleOTA(idx)}
                  className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
                    ota.selected
                      ? "bg-teal-700 border-teal-700 text-white"
                      : "border-slate-300 hover:border-teal-700"
                  )}
                >
                  {ota.selected && (
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-sm font-medium text-slate-900">{ota.platform}</span>
              </div>

              {ota.selected && ota.platform !== "Direct Only" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Commission:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ota.commission}
                    onChange={(e) => updateCommission(idx, parseFloat(e.target.value) || 0)}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              )}

              {!ota.selected && ota.platform !== "Direct Only" && (
                <span className="text-xs text-slate-400">{ota.commission}% commission</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-2xl text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────

interface StepDoneProps {
  propertyName: string;
  rooms: RoomData[];
  otas: OTAData[];
  propertyType: string;
  city: string;
  vatRegistered: boolean;
  vatNumber: string;
}

function StepDone({ propertyName, rooms, propertyType, city, vatRegistered, vatNumber }: StepDoneProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleGoToDashboard() {
    setError(null);
    setSubmitted(true);
    startTransition(async () => {
      try {
        await createPropertyFromOnboarding({
          propertyName,
          propertyType,
          city,
          vatRegistered,
          vatNumber,
          rooms,
          otas: [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setSubmitted(false);
      }
    });
  }

  return (
    <div className="w-full max-w-md text-center space-y-6">
      {/* Checkmark animation */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-600"
            style={{ animation: "draw-check 0.6s ease forwards" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your property is ready! 🎉</h2>
        <p className="text-slate-500 mt-2">
          Here&apos;s what your dashboard looks like with your setup.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Property</span>
          <span className="text-slate-900 font-medium">{propertyName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Type</span>
          <span className="text-slate-900 font-medium">{propertyType}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">City</span>
          <span className="text-slate-900 font-medium">{city}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Rooms</span>
          <span className="text-slate-900 font-medium">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">VAT</span>
          <span className="text-slate-900 font-medium">{vatRegistered ? "Registered" : "Not registered"}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleGoToDashboard}
        disabled={isPending || submitted}
        className="w-full py-3 rounded-2xl text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {isPending ? "Setting up..." : "Go to Dashboard →"}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────

export default function SetupPage() {
  const [step, setStep] = useState(0);

  // Step 2 state
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState("");

  // Step 3 state
  const [rooms, setRooms] = useState<RoomData[]>([
    { name: "Room 1", type: "Double", baseRate: 0 },
  ]);

  // Step 4 state
  const [otas, setOtas] = useState<OTAData[]>(OTA_PLATFORMS.map((o) => ({ ...o })));

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  return (
    <div className="flex flex-col items-center w-full">
      <ProgressBar step={step} total={STEPS.length} />

      {step === 0 && <StepWelcome onNext={next} />}

      {step === 1 && (
        <StepProperty
          propertyName={propertyName} setPropertyName={setPropertyName}
          propertyType={propertyType} setPropertyType={setPropertyType}
          city={city} setCity={setCity}
          vatRegistered={vatRegistered} setVatRegistered={setVatRegistered}
          vatNumber={vatNumber} setVatNumber={setVatNumber}
          onNext={next}
        />
      )}

      {step === 2 && (
        <StepRooms rooms={rooms} setRooms={setRooms} onNext={next} />
      )}

      {step === 3 && (
        <StepOTAs otas={otas} setOtas={setOtas} onNext={next} />
      )}

      {step === 4 && (
        <StepDone
          propertyName={propertyName}
          propertyType={propertyType}
          city={city}
          vatRegistered={vatRegistered}
          vatNumber={vatNumber}
          rooms={rooms}
          otas={otas.filter((o) => o.selected)}
        />
      )}
    </div>
  );
}

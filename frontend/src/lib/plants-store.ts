// "Mis plantas": se guardan en el navegador (localStorage) porque el MVP no
// tiene cuentas ni base de datos. Cuando exista backend, sustituir este módulo.

import { useSyncExternalStore } from "react";
import type { PlantProfile } from "@/lib/types";

export type SavedPlant = {
  id: string;
  scientificName: string;
  commonName?: string;
  catalogId?: string;
  profile: PlantProfile | null;
  photo?: string; // miniatura en data URL
  addedAt: string; // YYYY-MM-DD
  lastWateredAt?: string; // YYYY-MM-DD
  wateringIntervalDays: number;
  waterAmountMl?: number;
};

// Formato guardado: `{ version, plants }`. Al cambiar `SavedPlant` de forma
// incompatible, sube `SCHEMA_VERSION` y añade el paso en `migrate`.
const STORAGE_KEY = "florasense:plants";
const SCHEMA_VERSION = 2;
// v1 guardaba el array sin envoltorio bajo su propia clave.
const LEGACY_V1_KEY = "florasense:plants:v1";
const DEFAULT_INTERVAL_DAYS = 7;
const EMPTY: SavedPlant[] = [];

type StoredPlants = { version: number; plants: unknown[] };

let cache: SavedPlant[] | null = null;
// true si el último intento de guardar en localStorage falló (lleno o bloqueado).
let persistFailed = false;
const listeners = new Set<() => void>();

function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Valida una planta guardada; descarta las que no se pueden recuperar. */
function sanitizePlant(value: unknown): SavedPlant | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.scientificName !== "string") return null;

  const interval = Number(p.wateringIntervalDays);
  return {
    id: p.id,
    scientificName: p.scientificName,
    commonName: typeof p.commonName === "string" ? p.commonName : undefined,
    catalogId: typeof p.catalogId === "string" ? p.catalogId : undefined,
    profile:
      p.profile && typeof p.profile === "object" ? (p.profile as PlantProfile) : null,
    photo: typeof p.photo === "string" ? p.photo : undefined,
    addedAt: isISODate(p.addedAt) ? p.addedAt : todayISO(),
    lastWateredAt: isISODate(p.lastWateredAt) ? p.lastWateredAt : undefined,
    wateringIntervalDays:
      Number.isFinite(interval) && interval >= 1 ? Math.round(interval) : DEFAULT_INTERVAL_DAYS,
    waterAmountMl:
      typeof p.waterAmountMl === "number" && p.waterAmountMl > 0 ? p.waterAmountMl : undefined,
  };
}

/** Convierte cualquier versión conocida al formato actual. */
function migrate(data: unknown): SavedPlant[] {
  let plants: unknown[];
  if (Array.isArray(data)) {
    plants = data; // v1: array sin envoltorio
  } else if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as StoredPlants).plants)
  ) {
    plants = (data as StoredPlants).plants;
  } else {
    return EMPTY;
  }
  return plants.map(sanitizePlant).filter((p): p is SavedPlant => p !== null);
}

function persist(plants: SavedPlant[]): boolean {
  const payload: StoredPlants = { version: SCHEMA_VERSION, plants };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function load(): SavedPlant[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return migrate(JSON.parse(raw));

  const legacy = localStorage.getItem(LEGACY_V1_KEY);
  if (!legacy) return EMPTY;

  const plants = migrate(JSON.parse(legacy));
  // Solo se borra la clave antigua si el nuevo formato quedó guardado.
  if (persist(plants)) localStorage.removeItem(LEGACY_V1_KEY);
  return plants;
}

function read(): SavedPlant[] {
  if (cache) return cache;
  try {
    cache = load();
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function notify() {
  for (const listener of listeners) listener();
}

/** Actualiza el estado y lo guarda. Devuelve false si no se pudo guardar. */
function write(next: SavedPlant[]): boolean {
  cache = next;
  // Si falla, se mantiene en memoria durante esta sesión y se avisa en la UI.
  const ok = persist(next);
  persistFailed = !ok;
  notify();
  return ok;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSavedPlants() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** true si el último cambio no se pudo guardar en el navegador. */
export function usePlantsPersistFailed() {
  return useSyncExternalStore(
    subscribe,
    () => persistFailed,
    () => false
  );
}

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export type NewPlant = Omit<SavedPlant, "id" | "addedAt">;

function normalizePlantName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Busca una planta guardada por nombre científico, ignorando mayúsculas, acentos y espacios. */
export function findSavedPlant(plants: SavedPlant[], scientificName: string) {
  const key = normalizePlantName(scientificName);
  return plants.find(
    (plant) => normalizePlantName(plant.scientificName) === key,
  );
}

/**
 * Agrega una planta (o devuelve la existente con el mismo nombre).
 * `persisted` es false si solo quedó en memoria porque el navegador no la guardó.
 */
export function addPlant(plant: NewPlant): { plant: SavedPlant; persisted: boolean } {
  const existing = findSavedPlant(read(), plant.scientificName);
  if (existing) return { plant: existing, persisted: !persistFailed };
  const saved = { ...plant, id: newId(), addedAt: todayISO() };
  return { plant: saved, persisted: write([...read(), saved]) };
}

export function updatePlant(id: string, patch: Partial<SavedPlant>): boolean {
  return write(read().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function removePlant(id: string): boolean {
  return write(read().filter((p) => p.id !== id));
}

export function plantName(plant: Pick<SavedPlant, "commonName" | "scientificName">) {
  return plant.commonName || plant.scientificName || "Planta sin nombre";
}

// Fechas en formato local YYYY-MM-DD para no depender de la zona horaria.
export function todayISO() {
  return daysAgoISO(0);
}

export function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayNumber(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Días hasta el próximo riego (negativo si está atrasado), o null sin riego registrado. */
export function daysUntilWatering(plant: SavedPlant): number | null {
  if (!plant.lastWateredAt) return null;
  return (
    dayNumber(plant.lastWateredAt) +
    plant.wateringIntervalDays -
    dayNumber(todayISO())
  );
}

export function wateringLabel(days: number | null) {
  if (days === null) return "Registra su último riego";
  if (days < 0) return `Atrasada ${-days} ${days === -1 ? "día" : "días"}`;
  if (days === 0) return "Toca regar hoy";
  if (days === 1) return "Regar mañana";
  return `Regar en ${days} días`;
}

export function needsWater(plant: SavedPlant) {
  const days = daysUntilWatering(plant);
  return days !== null && days <= 0;
}

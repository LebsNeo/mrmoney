"use server";

import {
  getKPITrends as engineGetKPITrends,
  getKPISummary as engineGetKPISummary,
  getOccupancyCalendar as engineGetOccupancyCalendar,
  getRevenueLeakageReport as engineGetRevenueLeakageReport,
  getPerformanceBenchmarks as engineGetPerformanceBenchmarks,
} from "@/lib/kpi-engine";

export async function getKPITrends(propertyId: string, months: number) {
  return engineGetKPITrends(propertyId, months);
}

export async function getKPISummary(propertyId: string, period: string) {
  return engineGetKPISummary(propertyId, period);
}

export async function getOccupancyCalendar(propertyId: string, month: string) {
  return engineGetOccupancyCalendar(propertyId, month);
}

export async function getRevenueLeakageReport(propertyId: string, period: string) {
  return engineGetRevenueLeakageReport(propertyId, period);
}

export async function getPerformanceBenchmarks(propertyId: string, period: string) {
  return engineGetPerformanceBenchmarks(propertyId, period);
}

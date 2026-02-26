"use server";

import {
  getProfitabilityByRoom,
  getProfitabilityBySource,
  getDepartmentCosts,
  getMarginPerOccupiedNight,
  getCostBreakdown,
  generateProfitabilityInsights,
} from "@/lib/profitability";

export async function getRoomProfitability(propertyId: string, period: string) {
  return getProfitabilityByRoom(propertyId, period);
}

export async function getSourceProfitability(propertyId: string, period: string) {
  return getProfitabilityBySource(propertyId, period);
}

export async function getDepartmentCostsAction(propertyId: string, period: string) {
  return getDepartmentCosts(propertyId, period);
}

export async function getMarginPerOccupiedNightAction(propertyId: string, period: string) {
  return getMarginPerOccupiedNight(propertyId, period);
}

export async function getCostBreakdownAction(propertyId: string, period: string) {
  return getCostBreakdown(propertyId, period);
}

export async function getProfitabilityInsights(propertyId: string, period: string) {
  return generateProfitabilityInsights(propertyId, period);
}

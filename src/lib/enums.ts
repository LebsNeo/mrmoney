/**
 * Client-safe enum mirrors — use these in client components instead of importing from @prisma/client
 * @prisma/client contains Node.js-only code and must NOT be imported in client components
 */

export enum BookingSource {
  DIRECT = "DIRECT",
  WALKIN = "WALKIN",
  BOOKING_COM = "BOOKING_COM",
  AIRBNB = "AIRBNB",
  LEKKERSLAAP = "LEKKERSLAAP",
  EXPEDIA = "EXPEDIA",
  WHATSAPP = "WHATSAPP",
  OTHER = "OTHER",
}

export enum BookingStatus {
  RESERVED = "RESERVED",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export enum TransactionCategory {
  ACCOMMODATION = "ACCOMMODATION",
  FB = "FB",
  LAUNDRY = "LAUNDRY",
  CLEANING = "CLEANING",
  SUPPLIES = "SUPPLIES",
  OTA_COMMISSION = "OTA_COMMISSION",
  MAINTENANCE = "MAINTENANCE",
  REPAIRS_MAINTENANCE = "REPAIRS_MAINTENANCE",
  UTILITIES = "UTILITIES",
  SALARIES = "SALARIES",
  STAFF_WAGES = "STAFF_WAGES",
  MARKETING = "MARKETING",
  LOAN_INTEREST = "LOAN_INTEREST",
  BANK_CHARGES = "BANK_CHARGES",
  INSURANCE = "INSURANCE",
  VAT_OUTPUT = "VAT_OUTPUT",
  VAT_INPUT = "VAT_INPUT",
  EMPLOYEE_ADVANCE = "EMPLOYEE_ADVANCE",
  OTHER = "OTHER",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  CLEARED = "CLEARED",
  RECONCILED = "RECONCILED",
  VOID = "VOID",
}

export enum RoomType {
  SINGLE = "SINGLE",
  DOUBLE = "DOUBLE",
  TWIN = "TWIN",
  TRIPLE = "TRIPLE",
  QUEEN = "QUEEN",
  KING = "KING",
  FAMILY = "FAMILY",
  SUITE = "SUITE",
  STUDIO = "STUDIO",
  DORMITORY = "DORMITORY",
  OTHER = "OTHER",
}

export enum RoomStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

export enum PropertyType {
  GUESTHOUSE = "GUESTHOUSE",
  BNB = "BNB",
  HOTEL = "HOTEL",
  LODGE = "LODGE",
  APARTMENT = "APARTMENT",
  VILLA = "VILLA",
  HOSTEL = "HOSTEL",
  OTHER = "OTHER",
}

export enum PaymentMethod {
  CASH = "CASH",
  EFT = "EFT",
  CARD = "CARD",
  PAYFAST = "PAYFAST",
  PEACH = "PEACH",
  OTHER = "OTHER",
}

export type UserRole = "DELIVERY" | "BRANCH_MANAGER" | "SUPER_ADMIN";
export type PaymentMethod = "CASH" | "MPESA";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface Branch {
  _id: string;
  branchName: string;
  locationCity: string;
  managerId: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  branchId: string | null;
  branchName?: string | null;
  phoneNumber?: string;
  email?: string | null;
}

export interface Product {
  _id: string;
  label: string;
  sizeLiters: number;
  unitPrice: number;
  sortOrder: number;
  isActive: boolean;
}

export interface Transaction {
  _id: string;
  branchId: string | { _id: string; branchName: string };
  staffId: string;
  customerName: string | null;
  customerPhone: string;
  sizeLiters: number;
  quantity: number;
  unitPrice: number;
  amountTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  mpesaDetails?: {
    checkoutRequestId: string | null;
    receiptNumber: string | null;
    resultDesc: string | null;
  };
  createdAt: string;
}

export interface DashboardSummary {
  scope: "global" | "branch";
  totals: {
    cashTotal: number;
    mpesaTotal: number;
    totalSales: number;
    pendingMpesa: number;
  };
  branchRanking: {
    branchId: string;
    branchName: string;
    locationCity: string;
    revenue: number;
    salesCount: number;
    cashTotal: number;
    mpesaTotal: number;
  }[];
}

export interface ReconciliationRow {
  branchId: string;
  branchName: string;
  productId: string;
  productLabel: string;
  sizeLiters: number;
  morningDispatched: number;
  eveningPhysicalCount: number | null;
  totalSold: number;
  expectedRemaining: number;
  reconciledOk: boolean | null;
}

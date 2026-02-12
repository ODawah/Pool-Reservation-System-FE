import type { Employee, RevenueRecord, ExpenseRecord, ReceiptPayload, ShopItem } from '@/types/pool-hall';

const BASE_URL = 'http://192.168.1.18';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Employees
export const createEmployee = (data: Omit<Employee, 'id'>) =>
  request<Employee>('/create employee', { method: 'POST', body: JSON.stringify(data) });

export const deleteEmployee = (id: number) =>
  request<void>(`/delete by ID?id=${id}`, { method: 'DELETE' });

// Attendance
export const attendEmployee = (employeeID: number) =>
  request<void>(`/attend by employeeID?employeeID=${employeeID}`, { method: 'POST' });

export const leaveEmployee = (employeeID: number) =>
  request<void>(`/leave by employeeID?employeeID=${employeeID}`, { method: 'POST' });

// Revenue
export const createRevenue = (data: RevenueRecord) =>
  request<void>('/create revenue', { method: 'POST', body: JSON.stringify(data) });

// Shop
export const getShopItems = () =>
  request<ShopItem[]>('/get get all shop items');

// Receipts
export const createReceipt = (data: ReceiptPayload) =>
  request<void>('/create', { method: 'POST', body: JSON.stringify(data) });

// Expenses
export const createExpense = (data: ExpenseRecord) =>
  request<void>('/create', { method: 'POST', body: JSON.stringify(data) });

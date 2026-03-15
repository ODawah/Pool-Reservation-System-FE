import type { Employee, RevenueRecord, ShopItem, ReceiptPayload, Receipt, TableInfo, AttendanceRecord, ExpenseRecord } from '@/types/pool-hall';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (BASE_URL.includes('ngrok-free.app')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.detail ? ` - ${String(data.detail)}` : '';
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(`API error: ${res.status}${detail}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Tables
export const getTables = () =>
  request<TableInfo[]>('/tables/');

export const updateTablePrice = (tableId: number, price: number) =>
  request<void>(`/tables/${tableId}?price=${price}`, { method: 'PUT' });

// Shop
export const getShopItems = () =>
  request<ShopItem[]>('/shop/');

export const createShopItem = (name: string, price: number, quantity: number) =>
  request<ShopItem>(`/shop/?name=${encodeURIComponent(name)}&price=${price}&quantity=${quantity}`, { method: 'POST' });

export const updateShopItemPrice = (itemId: number, price: number) =>
  request<void>(`/shop/${itemId}/price?price=${price}`, { method: 'PUT' });

export const addShopItemQuantity = (itemId: number, quantity: number) =>
  request<void>(`/shop/${itemId}/quantity/add?quantity=${quantity}`, { method: 'PUT' });

export const subtractShopItemQuantity = (itemId: number, quantity: number) =>
  request<void>(`/shop/${itemId}/quantity/subtract?quantity=${quantity}`, { method: 'PUT' });

export const deleteShopItem = (itemId: number) =>
  request<void>(`/shop/${itemId}`, { method: 'DELETE' });

// Employees
export const getEmployees = () =>
  request<Employee[]>('/employee/');

export const createEmployee = (name: string, role: string, salary: number) =>
  request<Employee>(`/employee/?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}&salary=${salary}`, { method: 'POST' });

export const deleteEmployee = (id: number) =>
  request<void>(`/employee/${id}`, { method: 'DELETE' });

// Attendance
export const getAttendance = () =>
  request<AttendanceRecord[]>('/attendance/');

export const getTodayAttendance = () =>
  request<AttendanceRecord[]>('/attendance/today');

export const attendEmployee = (employeeId: number) =>
  request<void>(`/attendance/attend?employee_id=${employeeId}`, { method: 'POST' });

export const leaveEmployee = (employeeId: number) =>
  request<void>(`/attendance/leave?employee_id=${employeeId}`, { method: 'PUT' });

// Revenue
export const getRevenue = () =>
  request<RevenueRecord[]>('/revenue/');

export const createRevenue = (source: string, amount: number) =>
  request<void>(`/revenue/?source=${encodeURIComponent(source)}&amount=${amount}`, { method: 'POST' });

// Expenses
export const getExpenses = () =>
  request<ExpenseRecord[]>('/expenses/');

export const createExpense = (description: string, amount: number) =>
  request<ExpenseRecord>('/expenses/', {
    method: 'POST',
    body: JSON.stringify({ description, amount }),
  });

// Receipts
export const getReceipts = () =>
  request<Receipt[]>('/reciept/');

export const createReceipt = (data: ReceiptPayload) =>
  request<Receipt>('/reciept/', { method: 'POST', body: JSON.stringify(data) });

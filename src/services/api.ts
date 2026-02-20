import type { Employee, RevenueRecord, ShopItem, ReceiptPayload, Receipt, TableInfo, AttendanceRecord } from '@/types/pool-hall';

const BASE_URL = 'https://937e-102-41-84-41.ngrok-free.app';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

// Receipts
export const getReceipts = () =>
  request<Receipt[]>('/reciept/');

export const createReceipt = (data: ReceiptPayload) =>
  request<Receipt>('/reciept/', { method: 'POST', body: JSON.stringify(data) });
